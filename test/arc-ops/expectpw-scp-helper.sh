#!/usr/bin/expect
#
set PASS [lindex $argv 0]
set USER [lindex $argv 1]
set IP [lindex $argv 2]
set FILE [lindex $argv 3]
set REMOTE_DIR [lindex $argv 4]
set BIPASS [lindex $argv 5]
set CLRPASS [exec echo $PASS | base64 --decode]
set timeout 2
spawn scp $FILE $USER@$IP:$REMOTE_DIR
if { [string length $BIPASS ] == 0 } {
    expect -exact "Are you sure you want to continue connecting \(yes/no/\[fingerprint\]\)\?"
    send -- "yes\r"
}
expect  -exact "$USER@$IP's password:\r"
send -- "$CLRPASS\r"
expect eof
