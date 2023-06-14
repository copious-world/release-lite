
NODE_NAME='here'
DIR=./faux-assets
#
#   keep all the backrefs together so that the deepest lists the path back to the root
#
#    upload_scripts,download_scripts,ops,post_ops
#
GRAPH_FLDS='name,depth,sibs,user,pass,addr,backrefs,upload_scripts,download_scripts,ops,post_ops'
# for startup
GRAPH_STR=$(cat <<EOL
here,1,home otw copious popsong,richardalbertleddy,dGVzdDd0ZXN0Cg==,localhost, none
home,2,otw copious popsong g_sessions contacts endpoint-users otw-create,richard,dGVzdDR0ZXN0Cg==,76.229.181.242,here
otw,2,none,root,TDJ2PTk1LHFbKTR3Ri0K,45.32.219.78,here home
copious,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,here home
popsong,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,here home
plopzzzzz,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,butter
g_sessions,3,none,root,ZGlldHBpCg==,192.168.1.71,home here
contacts,3,none,root,ZGlldHBpCg==,92.168.1.75,home here
endpoint-users,3,none,root,ZGlldHBpCg==,192.168.1.77,home here
otw-create,3,none,root,ZGlldHBpCg==,192.168.1.81,home here
EOL
)




# code_pass=$(echo "test7test" | base64)
# code_pass=$(echo "test4test" | base64)
# code_pass=$(echo "L2v=95$J,q[)4wF-" | base64)
# code_pass=$(echo "hH8?ocrM%gebn8MN" | base64)
# code_pass=$(echo "dietpi" | base64)

# dGVzdDd0ZXN0Cg==
# dGVzdDR0ZXN0Cg==
# TDJ2PTk1LHFbKTR3Ri0K
# aEg4P29jck0lZ2VibjhNTgo=
# ZGlldHBpCg==


# GRAPH_STR=$(echo "$GRAPH_STR" | base64)
# OPS_STR=$(echo 'pwd\nls\npwd' | base64)
# UPLOADER="custom_uploader"

# cp ./assets/arc-traveler-setup.sh ./arc-traveler-setup.sh
# cp ./assets/arc-utils.sh ./arc-utils.sh

# ./arc-traveler-setup.sh $NODE_NAME $DIR "$GRAPH_STR" "$OPS_STR" "$UPLOADER"

# rm ./arc-traveler-setup.sh

DIR='distro-op'
echo $DIR
scp  ./assets/expectpw-ssh-cmd.sh richard@76.229.181.242:/home/richard/${DIR}/
# ssh -Y richard@76.229.181.242 "pushd ${DIR};expect expectpw-ssh-cmd.sh \"dietpi\" root 192.168.1.81 'mkdir /home/${DIR}';popd;"


code_pass=$(echo "TDJ2PTk1LHFbKTR3Ri0K" | base64 --decode)

ssh -Y richard@76.229.181.242 "pushd ${DIR};expect expectpw-ssh-cmd.sh 'L2v=95\$J,q[)4wF-' root 45.32.219.78 'mkdir /home/${DIR}';popd;"
# ssh -Y richard@76.229.181.242 "pushd ${DIR};expect expectpw-ssh-cmd.sh \"hH8?ocrM%gebn8MN\" root 155.138.235.197 'mkdir /home/${DIR}';popd;"


# ssh -Y richard@76.229.181.242 "pushd ${DIR};expect expectpw-ssh-cmd.sh \"dietpi\" root 192.168.1.71 'mkdir /home/${DIR}';popd;"
# ssh -Y richard@76.229.181.242 "pushd ${DIR};expect expectpw-ssh-cmd.sh \"dietpi\" root 192.168.1.75 'mkdir /home/${DIR}';popd;"
# ssh -Y richard@76.229.181.242 "pushd ${DIR};expect expectpw-ssh-cmd.sh \"dietpi\" root 192.168.1.77 'mkdir /home/${DIR}';popd;"

