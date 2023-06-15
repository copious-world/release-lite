
NODE_NAME='here'
DIR='arc-ops'
echo $DIR

mkdir ./$DIR
pushd $DIR
#
#   keep all the backrefs together so that the deepest lists the path back to the root
#
#    upload_scripts,download_scripts,ops,post_ops
#
GRAPH_FLDS='name,depth,sibs,user,pass,addr,backrefs,upload_scripts,download_scripts,ops,op_dir,y_fingerprint,post_ops'
# for startup
GRAPH_STR=$(cat <<EOL
here,1,home otw copious popsong ,richardalbertleddy,dGVzdDd0ZXN0Cg==,localhost,./arc-ops,1,none
home,2,g_sessions contacts endpoint-users otw-create,richard,dGVzdDR0ZXN0Cg==,76.229.181.242,./arc-ops,1,here
g_sessions,3,none,root,ZGlldHBpCg==,192.168.1.71,/home/arc-ops,0,home here
contacts,3,none,root,ZGlldHBpCg==,192.168.1.75,/home/arc-ops,0,home here
endpoint-users,3,none,root,ZGlldHBpCg==,192.168.1.77,/home/arc-ops,0,home here
otw-create,3,none,root,ZGlldHBpCg==,192.168.1.81,/home/arc-ops,0,home here
otw,2,none,root,TDJ2PTk1JEoscVspNHdGLQo=,45.32.219.78,/home/arc-ops,1,here
copious,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,/home/arc-ops,1,here
popsong,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,/home/arc-ops,1,here
EOL
)

# otw copious popsong
# otw copious popsong 
# otw,2,none,root,TDJ2PTk1LHFbKTR3Ri0K,45.32.219.78,/home/arc-ops,1,here home
# copious,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,/home/arc-ops,1,here home
# popsong,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,/home/arc-ops,1,here home
# plopzzzzz,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,055.138.235.197,0,/home/arc-ops,butter


GRAPH_STR=$(echo "$GRAPH_STR" | base64)
OPS_STR=$(echo 'pwd\nls' | base64)
UPLOADER="setup_uploader.sh"

PASS='TDJ2PTk1LHFbKTR3Ri0K'
USER='me'
IP='localhost'
OP_DIR=$DIR


bash ../assets/$UPLOADER $PASS $USER $IP $OP_DIR "1" "local"
#
popd
#
./${OP_DIR}/arc-traveler-setup.sh $NODE_NAME $DIR "$GRAPH_STR" "$OPS_STR" "$UPLOADER"

# rm ./arc-traveler-setup.sh
