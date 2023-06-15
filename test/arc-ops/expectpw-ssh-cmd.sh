#!/usr/bin/expect
#
set PASS [lindex $argv 0]
set USER [lindex $argv 1]
set IP [lindex $argv 2]
set CMD [lindex $argv 3]
set BIPASS [lindex $argv 4]
set CLRPASS [exec echo $PASS | base64 --decode]
set timeout 4
spawn bash  -c "ssh $USER@$IP '$CMD'"
if { [string length $BIPASS ] == 0 } {
    expect -exact "Are you sure you want to continue connecting \(yes/no/\[fingerprint\]\)\?"
    send -- "yes\r"
}
expect  -exact "$USER@$IP's password:\r"
send -- "$CLRPASS\r"
expect eof
