#
# "${nxt_pass}" ${nxt_user} ${nxt_ip} $OP_DIR
#
PASS=$1
USER=$2
IP=$3
OP_DIR=$4
fingerprint=$5
LOCAL=$6
#
#
UPLOADERS=( 
    'ssh-wrapper.sh'
    'setup_uploader.sh' 
    'expectpw-scp-helper.sh' 
    'expectpw-ssh-cmd.sh'
    'expectpw-ssh.sh'
    'arc-utils.sh' 
    'arc-traveler-setup.sh' 
    'arc-traveler.sh'
    'apt-installer.sh'
)

#

echo "PASS == $PASS"

#PASS=$( echo "$PASS" | base64 --decode )

for file in "${UPLOADERS[@]}"; do
    if [ ! -z "$LOCAL" ]; then
        cp ../assets/$file .
    else 
        expect expectpw-scp-helper.sh $PASS $USER $IP $file $OP_DIR $fingerprint #&
    fi
done

# for job in `jobs -p`
# do
#     echo $job
#     wait $job || let "FAIL+=1"
# done

