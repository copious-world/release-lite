pushd /home/naming
echo "naming EXEC run" > name_run.out
pwd >> name_run.out
expect ./expectpw-exec.sh dietpi root 192.168.1.77 tst.sh >> name_run.out
popd
pwd
