#!/usr/bin/expect
#  `'${sib.auth.pass}' ${sib.auth.user} ${sib.host.addr} ${g_hat_str} ${ops}`
# executes on the next hop and knows the downstream auth. causes next hop nodes to operate
#
set PASS [lindex $argv 0]
set USER [lindex $argv 1]
set IP [lindex $argv 2]
set GRRAPH_STR [lindex $argv 3]
set OPS_STR [lindex $argv 4]
set timeout 4
spawn bash  -c "ssh $USER@$IP 'bash -s' < $FILE $TARGET"
if { [string length $BIPASS ] == 0 } {
    expect -exact "Are you sure you want to continue connecting \(yes/no/\[fingerprint\]\)\?"
    send -- "yes\r"
}
expect  -exact "$USER@$IP's password:\r"
send -- "$PASS\r"
expect eof
