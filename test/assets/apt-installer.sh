
PASS=$1
PACKAGE=$2
(echo $PASS; yes) | sudo -S  apt-get install $PACKAGE

