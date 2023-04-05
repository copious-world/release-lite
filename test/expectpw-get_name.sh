#!/usr/bin/expect

set PASS [lindex $argv 0]
set USER [lindex $argv 1]
set IP [lindex $argv 2]
set timeout 1
spawn scp $USER@$IP:/home/naming/$IP.json ./cluster/
expect -exact "Are you sure you want to continue connecting \(yes/no/\[fingerprint\]\)\?"
send -- "yes\r"
expect  -exact "$USER@$IP's password:\r"
send -- "$PASS\r"
expect eof
