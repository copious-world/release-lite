#!/usr/bin/expect
#
set PASS [lindex $argv 0]
set USER [lindex $argv 1]
set IP [lindex $argv 2]
set FILE [lindex $argv 3]
set BIPASS [lindex $argv 4]
set TARGET [lindex $argv 5]
set CLRPASS [exec echo $PASS | base64 --decode]
#set timeout 1
spawn ./ssh-wrapper.sh $USER@$IP $FILE "$TARGET"
if { [string length $BIPASS ] == 0 } {
    expect -exact "Are you sure you want to continue connecting \(yes/no/\[fingerprint\]\)\?"
    send -- "yes\r"
}
expect  -exact "$USER@$IP's password:\r"
send -- "$CLRPASS\r"
expect "done-$USER@$IP" { exit }
