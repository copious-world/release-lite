#!/usr/bin/expect

set PASS [lindex $argv 0]
set USER [lindex $argv 1]
set IP [lindex $argv 2]
set timeout 1
exec rm -f check_name.json
spawn scp $USER@$IP:/home/check_name.json .
expect -exact "Are you sure you want to continue connecting \(yes/no/\[fingerprint\]\)\?"
send -- "yes\r"
expect  -exact "$USER@$IP's password:\r"
send -- "$PASS\r"
expect eof
