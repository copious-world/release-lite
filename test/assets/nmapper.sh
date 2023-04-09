pushd /home/naming
echo "calling nmap" > name_run.out
pwd >> name_run.out
nmap -sP 192.168.1.0/24 >> name_run.out
popd
pwd
