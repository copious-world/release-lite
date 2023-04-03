pushd /home/naming
echo "naming GET run" > name_run.out
pwd >> name_run.out
expect ./expectpw-put_name.sh dietpi root 192.168.1.77 >> name_run.out
popd
pwd


df -h # run this on the remote if possible...
ssh root@192.168.1.77 'cat /proc/cpuinfo'