pushd /home/naming
echo "naming GET run" > name_run.out
pwd >> name_run.out
expect ./expectpw-get_name.sh dietpi root 192.168.1.77 >> name_run.out
popd
pwd
