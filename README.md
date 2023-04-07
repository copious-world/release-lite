# release-lite

This package provides tools that generate scripts that prepare packages for transport to network accessible (ssh) hosts where the tools run the scripts by remote control to do such things as startup nginx servers, run endpoint servers, auth servers, install web artifacts, etc.

## purpose

The main aim here is to have something workable that deals with a very small domain of concepts to do with building web server clusters. As such, it aims to have a very small code base and supports a command template language that is very limited syntactically. The tools target a very specific set of servers and addresses their configurations, but it may be more general. The most general aspect is that it will expand templates of bash commands, or other commands, over lists of host names and addresses. If there is a chance to make it more generalized the attempt will be made and noted.

## install

This package provides two things: 1) classes accessible via the `require` function of node.js; 2) some command line entry points which are available when this package is installed gobally.


The classes are for going through a sequence of operations that set up a particular kind of web server.

The command line programs will generate some of the movable assets, shell scripts, and place them in directories indicated in configuration scripts which may be written in a custom template language.

To install locally for using the classes, run the following in you node.js project directory:

```
npm install -s release-lite
```

To access the command line tools run the following command:

```
npm install -g release-lite
```


## brief history

This package started as a quick project to provide internal development classes. A small number of people get the package and perhaps use it or discard it. 

This revision adds the command line programs, but leaves the old export classes alone. A short roadmap is being followed for a short time to aid the installation and testing of other packages. The effort should result in a slightly more useful set of tools for starting up servers that are part of a cluster to run a usefull web concern. Initially, the plan is to just get things up and running after having taken down previous invokations of the services. One can find out more about the services elsewhere.

This version adds the beginnings of the command language which deals with working with a number of machines known by IP address and their assigned names that are only known through this utility; that is, this is not DNS.


## command line utilities

Here is a list of command line tools that are available in the current release (order of use):

* **cluster-info**
* **put-cluster-names**
* **cluster-names**
* **bash-file-gen** (along with abbreviation bfg)

<a name='cluster-info' /> </a>
### [cluster-info](#cluster-info-detail)

This command line program provides the first step in defining the use of nodes picked to be part of a cluster. `cluster-info` makes use of `nmap` to find the nodes connected to a master node. It queries the user to see which nodes found will be part of the operations. For each node included in the final node list, it requests a user name and password for use by ssh running on the selected master node.

Prior to the use of this command line, it is expected that a cluster node will have no special directories nor files that can be queried in order for an application to understand the service role of the node.

After the use of this command, local files and directories should be ready for the use of `put-cluster-names`. Also, the nodes will have directories ready to receive files from the cluster master.

<a name='put-cluster-names' /> </a>
### [put-cluster-names](#put-cluster-names-detail)

The files created by `cluster-info` may have been edited by hand, or an option may be used with the command to provide the same edits. The edits add naming information and other information for use in identifying the role of a node in the cluster processes.

Once the files are ready, this command will send the files to their respective nodes of the cluster via the master node. The files will reside in a diretory `/home/naming`.

Later, processes needing to know the purpose of the nodes in the cluster may query the node for the files in `/home/naming`. If all conditions for the cluster remain the same, including DHCP assignmens, local copies of the files might provide enough information for operations to be set up and run. Otherwise, `cluster-names` may rebuild address tables and query the master node for his neighbor addresses, and then, finally, map addresses to their roles


<a name='cluster-names' /> </a>
### [cluster-names](#cluster-names-detail)

This command line program queries a LAN for IP addresses. It then attempts to fetch a file using `scp` to see if there is a file indicating a name and other information for use in building a table of hosts that will be part of the cluster. Once the table is built it may be imported into the file `all-machines.conf`, which is the configuration file expected by `bash-file-gen`.


<a name='bash-file-gen' /> </a>
### [bash-file-gen](#bash-file-gen-detail)

This is command line program reads a configuration file `all-machines.conf` which must be in the directory from which the bash command line is used. The command takes no parameters on the command line, as it uses only the configuration file. The structure and format of the file is explained in the section **command file format**

The process described by the configuration file is one that generates a number of bash command files that may be run on LAN nodes and remotes via the master node and ssh. The files may be generated for all nodes in the LAN to perform installations, and setups. Also, each node may be given custom commands. (The configuration file format provides node by node sections for particular operations requiring more than one node.)

## details

In the sections below, further details are given for each of the commands. Some sections may link to other files with description, examples and tutorials for the commands.

* [cluster-info](#cluster-info-detail)
* [put-cluster-names](#put-cluster-names-detail)
* [cluster-names](#cluster-names-detail)
* [bash-file-gen](#bash-file-gen-detail)


<a name='cluster-info-detail' /> </a>
## using `cluster-info `
[&uArr; back to overview](#cluster-info)

This command knows of, at least, one cluster master. The master is not set up as a continuous controller of nodes, but acts as the first point of address when using `ssh`. The controller will then use `ssh` to carry operations forward to internal LAN nodes and to external nodes (cloud based).

The call will be similar to following, where `<user>` will be replaced by the user name on the host whose IP addres is `<IP-addr>`. 

```
cluster-info <user> <IP-addr>
```

When the commands this controls require `ssh` or `scp` authorization, the user will be prompted for the password on `<IP-addr>`.

```
password for: <user>@<IP-addr>
```


This command causes script files to be ported to the master which are then used to deal with running `ssh` and `scp` commands. A number of the script files are custom `expect` scripts that provide password and fingerprint responses. 

This command first uses its `ssh` bashfile and `expect` framework to create a directory `/home/naming` on each node's disk. This directory becomes the place where files will be stored so that commands, used later, can obtain coalesced and costomized information in order to figure out how to use the nodes.

The second thing this command does is to gather information about each node having to do with CPU cores, disk drives, and RAM availability. 

The administrator can set the application names of the nodes by editing the files that this command deposits in a local directory `./named-machines`.  This command makes the directory, `./named-machines` in its working directory. Later, the next command, `put-cluster-names`, will store the updated files on each node under `/home/naming`. 

### setting up a workspace after installing

The npm command runs pretty quickly. But, there are a number of files that need to be present in the working directory of this comamnd. The same files will be needed for the rest of the commands as well.

The files required are stored in a directory `assets` under the top level of this package, `release-lite`. Using `get-npm-assets` the files can be placed there.

After installing `release-list` globally, navigate to the directory where you will run commands. Then make use of `get-npm-assets`. The following is a possible sequence:

```
npm install -g get-npm-assets
npm install -g release-lite
mkdir get-npm-assets
cd ./my-cluster-ops
get-npm-assets cluster-info
cluster-info <user> <IP-addr>
```

The commands will make the sub-directories they need within your chosen diretory.


### prompts

The program `cluster-info` prompts the user for each `ssh` call. It also anticipates being called more than once and asks certain master node queries can be skipped.

When it retuns the list of LAN nodes available for being used in the cluster, this program prompts the user for the user name and password required for the master node to make `ssh` requests to the LAN nodes. It also asks if there is JSON file containing information about external nodes that will be configured with the LAN.

Here is a possible interaction that may occur:

```
$cluster-info user1 10.10.10.10
user1@10.10.10.10's password: 
user1@10.10.10.10's password: 
calling nmap
// outputs nmap output
/home/naming
my-laptop@ 10.10.10.12
Use this node?: N
------
DietPi@ 10.10.10.10.70
Use this node?: Y
DietPi  user: root
DietPi  password: fnystf 
{ label: 'DietPi', user: 'root', pass: 'fnystf', addr: '10.10.10.10.70' }
Is this data correct?: Y
------
my-other-laptop@ 10.10.10.14
Use this node?: N
------
my-phone@ 10.10.10.16
Use this node?: N
------
DietPi@ 10.10.10.88
Use this node?: Y
DietPi  user: root
DietPi  password: fnrstf
{ label: 'DietPi', user: 'root', pass: 'fnrstf', addr: '10.10.10.88' }
Is this data correct?: Y
------
Do you want to add the remote table in remote_table.json? Y
The file name_run.out already exists. Do you want to use it? N
user1@10.10.10.10's password: 
prepare_controller_exec_ssh

    pushd /home/naming
    echo "naming EXEC run" > name_run.out
    pwd >> name_run.out
    
        expect ./expectpw-exec.sh fnystf root 10.10.10.10.70 pars-act.sh >> name_run.out
        echo ">>>>>>10.10.10.10.70<<<<<<" >> name_run.out
        
        expect ./expectpw-exec.sh fnrstf root 10.10.10.10.75 pars-act.sh >> name_run.out
        echo ">>>>>>10.10.10.10.75<<<<<<" >> name_run.out
        
 		 // external
        expect ./expectpw-exec.sh 'sdo8fjwrj023-71!w' root 55.55.55.55.55 pars-act.sh >> name_run.out
        echo ">>>>>>55.55.55.55.55<<<<<<" >> name_run.out
          
    popd
    pwd
   
user1@10.10.10.10's password: 
user1@10.10.10.10's password: 
[ '/dev/mmcblk0p1   29G  2.4G   27G   9% /' ]
[
  '/dev/mmcblk0p1  118G  2.3G  114G   2% /',
  '/dev/sda1        58G   13M   58G   1% /media/services'
]
[
  '/dev/vda1        47G   12G   33G  27% /',
  '/dev/loop3      117M  117M     0 100% /snap/core/14784',
  '/dev/loop2       64M   64M     0 100% /snap/core20/1828',
  '/dev/loop4       44M   44M     0 100% /snap/certbot/2836',
  '/dev/loop0      117M  117M     0 100% /snap/core/14946',
  '/dev/loop5       64M   64M     0 100% /snap/core20/1852',
  '/dev/loop6       45M   45M     0 100% /snap/certbot/2913'
]
machine info for 10.10.10.10.70, 10.10.10.10.75, 55.55.55.55.55, 10.10.10.10 written

```

In another case, the first output file may be present from a previous run:

```
The table of hosts already exists. Do you want to use it? Y
Do you want to add the remote table in remote_table.json? Y
// here you get a large object map of cluster entries
//  ... then
The file name_run.out already exists. Do you want to use it? Y
[ '/dev/mmcblk0p1   29G  2.4G   27G   9% /' ]
[
  '/dev/mmcblk0p1  118G  2.3G  114G   2% /',
  '/dev/sda1        58G   13M   58G   1% /media/services'
]
[
  '/dev/vda1        47G   12G   33G  27% /',
  '/dev/loop3      117M  117M     0 100% /snap/core/14784',
  '/dev/loop2       64M   64M     0 100% /snap/core20/1828',
  '/dev/loop4       44M   44M     0 100% /snap/certbot/2836',
  '/dev/loop0      117M  117M     0 100% /snap/core/14946',
  '/dev/loop5       64M   64M     0 100% /snap/core20/1852',
  '/dev/loop6       45M   45M     0 100% /snap/certbot/2913'
]
machine info for 10.10.10.10.70, 10.10.10.10.75, 55.55.55.55.55, 10.10.10.10 written

```


<a name='put-cluster-names-detail' /> </a>
## using `put-cluster-names`
[&uArr; back to overview](#put-cluster-names)

This command reads two or three files that can be found in the directory, `save-data`. The files will have been created by `cluster-info`. The files are:

*  `addr_table.json` - the results of the nmap query and user interaction
*  `all_machine_info.json` - an object mapping IPs to host information
*  `remote_table.json` - a hand made file of nodes outside the aegis of the master node on the LAN


`all_machine_info.json` is created by `cluster-info` and contains information about each node. It does not contain information fields that help the remaining commands. Someone who administrates the file will have to add an abbreviationm `abbr` (also called a label at times) and a `dns` field. 

Once again, the fields are: 

 * `abbr` - an abbreviation that can act as a variable, stand in, for use in the script files processed by `bash-file-gen`.
 * `dns1 - an actual DNS name or another indicator for local machines that are not managed by DNS.

For example, one of the very small machines running DietPi has the following fields in its record in `all_machine_info.json`.

```
  "10.10.10.75": {
    "addr": "10.10.10.75",
    
    "abbr" : "contacts",					<-- adding these fields
    "dns" : "@home:LAN -- DietPi",

```


Sometimes a single machine will host more than one DNS. In that case, one object in the file can stand for both. In this case, an array is used to list the abbreviations and DNS entries under the two fields. An example, follows:

```
    "abbr" : [ "copious",  "popsong" ],
    "dns" : [ "copious.world", "popsongnow.com" ],
```

In this case, the abbreviation must be at the same index under "abbr" as the DNS name is in its array under "dns".


After the command has run, every machine in the the cluster, local and external (remote) will have the file <IP>.json under '/home/naming'. For example, once logged into `10.10.10.70`, the following commands could be done.

```
$pushd /home/naming
$ls
10.10.10.70.json
```

#### Technical detail

`put-cluster-names` creates a directory `named-machines` where it puts the files destined for the nodes and external machines. After it fills the directory, it sends the whole directory via `scp` to the master node. Then, the master node sends each file to their respective machines.
The `named-machines` is not removed by the commands provided by this package, but it has no other purpose for these commands.

<a name='cluster-names-detail' /> </a>
## using `cluster-names`
[&uArr; back to overview](#cluster-names)

Here is a run of cluster names:

```
$cluster-names user2 10.10.10.10
prepare_controller_get_ssh
user2@10.10.10.10's password: 
user2@10.10.10.10's password: 
user2@10.10.10.10's password: 
10.10.10.70 ::
{ label: 'DietPi', user: 'root', pass: 'fnystf', addr: '10.10.10.70' }
10.10.10.75 ::
{ label: 'DietPi', user: 'root', pass: 'fnrstf', addr: '10.10.10.75' }
10.10.10.10  ::
{
  label: 'master',
  user: 'root',
  pass: 'garbledygoop',
  addr: '10.10.10.10'
}
55.55.55.55 ::
{
  label: 'copious',
  user: 'root',
  pass: 'sdo8fjwrj023-71!w',
  addr: '55.55.55.55'
}

    pushd /home/naming
    echo "naming PUT run" > name_run.out
    pwd >> name_run.out
    
        expect ./expectpw-get_name.sh 'fnystf' root 10.10.10.70 >> name_run.out
        echo ">>>>>>10.10.10.70<<<<<<" >> name_run.out
        
        expect ./expectpw-get_name.sh 'fnrstf' root 10.10.10.75 >> name_run.out
        echo ">>>>>>10.10.10.75<<<<<<" >> name_run.out
                
        expect ./expectpw-get_name.sh 'garbledygoop' user2 10.10.10.10 >> name_run.out
        echo ">>>>>> 10.10.10.10 <<<<<<" >> name_run.out
        
        expect ./expectpw-get_name.sh 'sdo8fjwrj023-71!w' root 55.55.55.55 >> name_run.out
        echo ">>>>>> 55.55.55.55 <<<<<<" >> name_run.out
           
    popd
    pwd

```


The output at the end is `controller_get_ssh`.

`cluster-names` can take a few extra parameters, one to save the data in a foramt, the other to tell it to use files it generated previously. The parameter that tells it to use existing files is `bipass`; it has to be the last parameter and the directtive for file generation must be included. 

Here is another possible run:

```
$cluster-names user2 10.10.10.10 'tables->save-data' bipass
{
  '10.10.10.70': {
    label: 'DietPi',
    user: 'root',
    pass: 'fnystf',
    addr: '10.10.10.70'
  },
  '10.10.10.75': {
    label: 'DietPi',
    user: 'root',
    pass: 'fnrstf',
    addr: '10.10.10.75'
  },
  'popsongnow.com': {
    label: 'popsong',
    user: 'root',
    pass: 'sdo8fjwrj023-71!w',
    addr: '55.55.55.55'
  },
  'copious.world': {
    label: 'copious',
    user: 'root',
    pass: 'sdo8fjwrj023-71!w',
    addr: '55.55.55.55'
  },
  '10.10.10.10': {
    label: 'home',
    user: 'user2',
    pass: 'garbledygoop',
    addr: '10.10.10.10'
  }
}
```

For this run, the tables will be generated in a format for use by `bash-file-gen` and placed in the directory `save-date`. The previously generated files will be used since `bipass` is included on the end of the command line.

Both commands will create files `hosts_obj_list.txt` and `hosts.txt` in the chosen directory. 

`hosts.txt` might look like this:, a table format that `bash-file-gen` uses for input.

```
=addr              =abbr              =host
10.10.10.70	:  endpoints	: @home:LAN -- DietPi
10.10.10.75	:  contacts	: @home:LAN -- DietPi
10.10.10.10	:  home		: @home -- Mint Linux
55.55.55.55	:  copious	: copious.world
55.55.55.55	:  popsong	: popsongnow.com

```


<a name='bash-file-gen-detail' /> </a>
## using `bash-file-gen`
[&uArr; back to overview](#bash-file-gen)

This command, `bash-file-gen`, can be run after the previous commands have been used and after a configuration file, `all-machines.conf`, has been created.

This command reads `all-machines.conf` and performs the actions described. It may also read another file `select-machine-actions.json` in order to skip certain actions or provide custom generation filters for particular machine and actions. 

The preparation steps for using this command is just about getting set up to run the previous commands and calling them.

#### preparation - quick review

* **cluster-info**
* **put-cluster-names**
* **cluster-names**
* **bash-file-gen** (along with abbreviation bfg)

Here is a summary of the steps. Check out the sections on the other commands to get more information about what to do.

1. Set up a LAN and spin up cloud servers.
2. Select one of the LAN nodes as the master server.
3. Make a directory to work in, navigate there, and use `get-npm-assets` to get the files that will be used in running the tools. 
4. Make a small table `save-data/remote_table.json` of external nodes. 
5. run the command `cluster-info`
6. Look for the file `save-data/all_machine_info.json` and edit it to include abbreviations and DNS information. (An interactive program may help with this.)
7. run the command `put-cluster-names`.
8. at any time later (maybe someone else with a copy of the current diretory) run the command `cluster-names`. This will prepare files for use within `all-machines.conf`.
9. Edit `all-machines.conf` or create it. (this might be a long and complicated collection of files depending on what is to be done).
10. run the command `bash-file-gen`. 


For step 3. the file,  `save-data/remote_table.json`,  should look like the following and include the master node:

```
{
    "popsongnow.com": { "label":"popsong" ,"user":"root", "pass":"sdo8fjwrj023-71!w", "addr":"55.55.55.55" },
    "copious.world": { "label":"copious" ,"user":"root", "pass":"sdo8fjwrj023-71!w", "addr":"55.55.55.55" }
    "10.10.10.10": { "label":"home" ,"user":"user1", "pass":"garbledygoop", "addr":"10.10.10.10" }
}

```

Here is an example for invoking the command:

```
$bash-file-gen
```

The command creates a directory `scripts` which includes all the scripts generated from data in the files in the current directory.

```
$bash-file-gen
ls ./scripts
...				// a lot of data comes out
```

Finally, `bash-file-gen` will run the generated scripts on the target machines use the `ssh` and `expect` framework pulled in by `get-npm-assets`.


## command file format

The format of the template command file is custom. Yet, it is fairly simplistic. It is not calculating, just substituting. A short description is provided here.

TBD

## Previous doc 

`This doc is going to be replaced. (deprecated?)`

This is a package for uploading to a server with ssh.  
The next to last step unpacks a .tar.tgz file.   
The last step runs an ssh file that moves files to their locations and finally updates running micro services 
by restarting them with pm2 commands.

Look in the example directory for a template json file.

Under the domains, you will see a the *from* field. This field says where the local files are that will be going up to the host.

Html is copied to the **host** html directory set by the top level field *remote_html*.
They are place in the subdirectory specified by *subdir*

The micro services (here just node.js for now) are copied into the **host** /home directory under the *subdir* provided
for the micro service.

There is a staging folder. The local files are copied from their sources to the staging folder.
The folder will be tar'ed and gzipped.
Will then be moved to the host via scp.

The name of the folder for staging and the file name for the zip file are 
the same and may be specified within the release object using the field *folder*. 
There should be no consequence of name selection except or proper file name formats.

The staging object also has a field *special_node_modules* which specifies which node_module files to copy directly to the host.

There is also a field, *special_content* which is a list of object specifying file names and their text content, which should
be constructed on the host and place in the subdir of the micro serivice for each domain. This is a copy for each domain.

The *remote_control* allows for the final script command to be configured.

HTML files are compressed, but there is a mechanism to keep a section out of the compression process.
(There were some CSS menu tricks that needed list elements to be on separate lines. {most likely some bug}).
The field *dont_compress* specifies a way of finding the section and allows
a variable to be specified to take the place of the region during compression.


There are countless ways of improving this script. They are not all going to be considered at this time. Hence, the 'lite'
in the name of this module. 

One improvement that may happen fairly soon is that **ecosystem** for pm2 may be constructed by the tool.
For now, the **ecosystem** is passed to the Releaser object constructer (see test.js).

## usage

 npm test **your ssh password**
 
 NOTE: you will have to edit test.js in order to set up your pm2 ecosystem.
 NOTE: you will need to create your own releaser.json that moves your files. No files for the example are included.
 
 
 
 
