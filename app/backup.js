/* Portable, teacher-controlled backups. No privileged keys or external uploads. */

const encoder = new TextEncoder();
const HEX = bytes => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");

async function sha256(bytes, hashProvider = crypto.subtle) {
  return HEX(new Uint8Array(await hashProvider.digest("SHA-256", bytes)));
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let n = index;
  for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function u16(view, offset, value) { view.setUint16(offset, value, true); }
function u32(view, offset, value) { view.setUint32(offset, value, true); }

// ZIP32, STORE mode, UTF-8 filenames. Each course JSON is directly restorable.
export function zipEntries(entries, date = new Date()) {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 200)
    throw new Error("Invalid ZIP entry count.");
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >>> 1);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const local = [], central = [];
  let offset = 0, centralSize = 0;
  for (const entry of entries) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(entry.name)) throw new Error("Invalid ZIP entry filename.");
    const name = encoder.encode(entry.name);
    const data = entry.data instanceof Uint8Array ? entry.data : encoder.encode(entry.data);
    const crc = crc32(data);
    if (data.length > 6000000 || offset + data.length > 100000000)
      throw new Error("Backup exceeds size limits.");
    const hdr = new Uint8Array(30 + name.length);
    const h = new DataView(hdr.buffer);
    u32(h, 0, 0x04034b50); u16(h, 4, 20); u16(h, 6, 0x0800);
    u16(h, 8, 0); u16(h, 10, time); u16(h, 12, day);
    u32(h, 14, crc); u32(h, 18, data.length); u32(h, 22, data.length);
    u16(h, 26, name.length); u16(h, 28, 0);
    hdr.set(name, 30);
    local.push(hdr, data);
    const chdr = new Uint8Array(46 + name.length);
    const c = new DataView(chdr.buffer);
    u32(c, 0, 0x02014b50); u16(c, 4, 20); u16(c, 6, 20);
    u16(c, 8, 0x0800); u16(c, 10, 0); u16(c, 12, time); u16(c, 14, day);
    u32(c, 16, crc); u32(c, 20, data.length); u32(c, 24, data.length);
    u16(c, 28, name.length); u16(c, 30, 0); u16(c, 32, 0);
    u16(c, 34, 0); u16(c, 36, 0); u32(c, 38, 0); u32(c, 42, offset);
    chdr.set(name, 46);
    central.push(chdr);
    offset += hdr.length + data.length;
    centralSize += chdr.length;
  }
  const eocd = new Uint8Array(22);
  const e = new DataView(eocd.buffer);
  u32(e, 0, 0x06054b50); u16(e, 4, 0); u16(e, 6, 0);
  u16(e, 8, entries.length); u16(e, 10, entries.length);
  u32(e, 12, centralSize); u32(e, 16, offset); u16(e, 20, 0);
  const result = new Uint8Array(offset + centralSize + eocd.length);
  let cursor = 0;
  for (const part of [...local, ...central, eocd]) {
    result.set(part, cursor);
    cursor += part.length;
  }
  return result;
}

async function pagedRows(client, table, field, value, columns = "*", max = 2500) {
  const rows = [];
  for (let start = 0; start <= max; start += 500) {
    const { data, error } = await client.from(table).select(columns)
      .eq(field, value).order("id").range(start, start + 499);
    if (error) throw new Error("Cannot read " + table + ": " + error.message);
    rows.push(...(data || []));
    if (rows.length > max) throw new Error("Too many " + table + " records for pilot backup.");
    if (!data || data.length < 500) return rows;
  }
  throw new Error("Backup page limit exceeded.");
}

function versionSignature(rows) {
  return JSON.stringify(rows.map(r => [r.id, String(r.revision), r.updated_at]));
}
function validateChildLinks(course, units, lessons, exceptions) {
  const keys = new Set(units.map(u => u.id));
  if (keys.size !== units.length ||
      units.some(u => u.course_id !== course.id) ||
      lessons.some(l => l.course_id !== course.id || !keys.has(l.unit_id)) ||
      exceptions.some(e => e.course_id !== course.id))
    throw new Error("Inconsistent course/unit/lesson relationships; backup aborted.");
}

/* Reads exclusively through a signed-in user's RLS-protected client.
 * Returns one ZIP with independent, restore-compatible v1 course exports.
 * Consistency is checked against a second read; not a database-wide snapshot. */
export async function makeAccountBackup(client, user, notify = () => {}, hashProvider) {
  if (!user?.id) throw new Error("Sign in before exporting a backup.");
  const { data: verified, error: authError } = await client.auth.getUser();
  if (authError || verified?.user?.id !== user.id)
    throw new Error("Authentication changed. Sign in again before exporting.");
  const courses = await pagedRows(client, "courses", "owner_id", user.id, "*", 100);
  if (!courses.length) throw new Error("No saved courses to back up.");
  if (courses.length > 100) throw new Error("Pilot backup limit is 100 courses.");
  if (courses.some(c => c.owner_id !== user.id)) throw new Error("Unexpected course owner.");
  const files = [], items = [], createdAt = new Date().toISOString();
  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    notify("Reading course " + (i + 1) + " of " + courses.length + "…");
    const [units, lessons, calendarExceptions] = await Promise.all([
      pagedRows(client, "units", "course_id", course.id, "*", 200),
      pagedRows(client, "lessons", "course_id", course.id, "*", 2000),
      pagedRows(client, "calendar_exceptions", "course_id", course.id, "*", 1000)
    ]);
    validateChildLinks(course, units, lessons, calendarExceptions);
    // Check that the records did not change while being read.
    const [coursesCheck, unitsCheck, lessonsCheck, exceptionsCheck] = await Promise.all([
      pagedRows(client, "courses", "id", course.id, "id,revision,updated_at", 1),
      pagedRows(client, "units", "course_id", course.id, "id,revision,updated_at", 200),
      pagedRows(client, "lessons", "course_id", course.id, "id,revision,updated_at", 2000),
      pagedRows(client, "calendar_exceptions", "course_id", course.id, "id,revision,updated_at", 1000)
    ]);
    if (versionSignature([course]) !== versionSignature(coursesCheck) ||
        versionSignature(units) !== versionSignature(unitsCheck) ||
        versionSignature(lessons) !== versionSignature(lessonsCheck) ||
        versionSignature(calendarExceptions) !== versionSignature(exceptionsCheck))
      throw new Error("A course was edited during backup. Retry after saving all changes.");
    const exportObject = {
      schema: "course-planner.pilot-export.v1", exportedAt: createdAt,
      course, units, lessons, calendarExceptions
    };
    const filename = "course-planner-" + course.id + ".json";
    const bytes = encoder.encode(JSON.stringify(exportObject, null, 2));
    if (bytes.length > 6000000) throw new Error("One course exceeds the restore size limit.");
    files.push({ name: filename, data: bytes });
    items.push({
      courseId: course.id, courseName: course.name, filename,
      sha256: await sha256(bytes, hashProvider),
      counts: { units: units.length, lessons: lessons.length, calendarExceptions: calendarExceptions.length }
    });
  }
  const { data: finalAuth, error: finalError } = await client.auth.getUser();
  if (finalError || finalAuth?.user?.id !== user.id)
    throw new Error("Authentication changed while preparing backup. No backup was downloaded.");
  const manifest = {
    schema: "course-planner.account-backup-manifest.v1",
    createdAt, courseCount: items.length,
    courses: items,
    note: "Each course-planner-*.json can be restored independently using Import / Restore Course. Keep this ZIP in private storage outside Supabase. A manual backup is not automatic disaster recovery."
  };
  files.push({ name: "backup-manifest.json", data: encoder.encode(JSON.stringify(manifest, null, 2)) });
  return { bytes: zipEntries(files), manifest };
}
