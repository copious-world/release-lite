
NODE_NAME='here'
DIR=./assets
#
#
GRAPH_FLDS='name,depth,sibs,user,pass,addr,backrefs'
GRAPH_STR=$(cat <<EOL
here,1,home otw copious popsong,richardalbertleddy,dGVzdDd0ZXN0Cg==,localhost, none
home,2,otw copious popsong g_sessions contacts endpoint-users otw-create,richard,dGVzdDR0ZXN0Cg==,76.229.181.242,here
otw,2,none,root,TDJ2PTk1LHFbKTR3Ri0K,45.32.219.78,here home
copious,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,here home
popsong,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,here home
plopzzzzz,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,butter
EOL
)

# code_pass=$(echo "test7test" | base64)
# echo $code_pass
# code_pass=$(echo "test4test" | base64)
# echo $code_pass
# code_pass=$(echo "L2v=95$J,q[)4wF-" | base64)
# echo $code_pass
# code_pass=$(echo "hH8?ocrM%gebn8MN" | base64)
# echo $code_pass

# dGVzdDd0ZXN0Cg==
# dGVzdDR0ZXN0Cg==
# TDJ2PTk1LHFbKTR3Ri0K
# aEg4P29jck0lZ2VibjhNTgo=


GRAPH_STR=$(echo "$GRAPH_STR" | base64)
OPS_STR=$(echo 'pwd\nls\npwd' | base64)
UPLOADER="custom_uploader"

./assets/arc-traveler-setup.sh $NODE_NAME $DIR "$GRAPH_STR" "$OPS_STR" "$UPLOADER"