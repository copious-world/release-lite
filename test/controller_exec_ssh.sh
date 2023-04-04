
    pushd /home/naming
    echo "naming EXEC run" > name_run.out
    pwd >> name_run.out
    
        expect ./expectpw-exec.sh dietpi root 192.168.1.71 pars-act.sh >> name_run.out
        echo ">>>>>>192.168.1.71<<<<<<" >> name_run.out
        
        expect ./expectpw-exec.sh dietpi root 192.168.1.75 pars-act.sh >> name_run.out
        echo ">>>>>>192.168.1.75<<<<<<" >> name_run.out
        
        expect ./expectpw-exec.sh dietpi root 192.168.1.77 pars-act.sh >> name_run.out
        echo ">>>>>>192.168.1.77<<<<<<" >> name_run.out
        
        expect ./expectpw-exec.sh dietpi root 192.168.1.81 pars-act.sh >> name_run.out
        echo ">>>>>>192.168.1.81<<<<<<" >> name_run.out
                
    popd
    pwd
   