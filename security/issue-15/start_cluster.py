"""Start/stop a new fictional local PG17 cluster using existing free PostgreSQL tools."""
import argparse,json,os,stat,subprocess,tempfile
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--pg-bin',type=Path,required=True)
p.add_argument('--stop',type=Path,help='Stop this exact private staging cluster; does not delete any files')
a=p.parse_args()
pg=a.pg_bin.resolve()
version=subprocess.run([str(pg/'postgres'),'--version'],capture_output=True,text=True,check=True).stdout.strip()
if not version.startswith('postgres (PostgreSQL) 17.'): raise SystemExit('Requires PostgreSQL 17')
if a.stop:
    base=a.stop.resolve()
    if not str(base).startswith('/private/tmp/course-planner-f3-cluster-') or base.stat().st_uid!=os.getuid():
        raise SystemExit('Refusing an unknown cluster')
    config=(base/'data/postgresql.conf').read_text()
    if "cluster_name = 'course_planner_issue15_disposable'" not in config: raise SystemExit('Cluster marker absent')
    subprocess.run([str(pg/'pg_ctl'),'-D',str(base/'data'),'-m','fast','-w','stop'],check=True)
else:
    base=Path(tempfile.mkdtemp(prefix='course-planner-f3-cluster-',dir='/private/tmp'))
    socket=base/'socket';socket.mkdir(mode=0o700)
    r=subprocess.run([str(pg/'initdb'),'-D',str(base/'data'),'-U','f3_setup','--auth-local=trust','--auth-host=reject','--encoding=UTF8','--no-locale'],capture_output=True,text=True)
    if r.returncode:
        print(r.stdout+r.stderr);raise SystemExit(r.returncode)
    with (base/'data/postgresql.conf').open('a') as f:
        f.write("\nlisten_addresses = ''\ncluster_name = 'course_planner_issue15_disposable'\nmax_connections = 20\nshared_buffers = '32MB'\nunix_socket_directories = '"+str(socket)+"'\nport = 55415\n")
    subprocess.run([str(pg/'pg_ctl'),'-D',str(base/'data'),'-l',str(base/'server.log'),'-w','start'],check=True)
    print(json.dumps({'cluster':str(base),'socket':str(socket),'version':version,'tcp_enabled':False},indent=2))
