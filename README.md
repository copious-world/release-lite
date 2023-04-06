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

* **get-cluster-info**
* **put-cluster-names**
* **cluster-names**
* **bash-file-gen** (along with abbreviation bfg)

<a name='cluster-info' /> </a>
### [get-cluster-info](#cluster-info-detail)

This command line program provides the first step in defining the use of nodes picked to be part of a cluster. `get-cluster-info` makes use of `nmap` to find the nodes connected to a master node. It queries the user to see which nodes found will be part of the operations. For each node included, it requests a user name and password for use by ssh running on the selected master node.

Prior to the use of this command line, it is expected that a cluster node will have no special directories nor files that can be queried in order for an application to understand the service role of the node.

After the use of this command, local files and directories should be ready for the use of `put-cluster-names`. Also, the nodes will have directories ready to receive files from the cluster master.

<a name='put-cluster-names' /> </a>
### [put-cluster-names](#put-cluster-names-detail)

The files created by `get-cluster-info` may have been edited by hand, or an option may be used with the command to provide the same edits. The edits add naming information and other information for use in identifying the role of a node in the cluster processes.

Once the files are ready, this command will send the files to their respective nodes of the cluster via the master node. The files will reside in a diretory `/home/naming`.

Later, processes needing to know the purpose of the nodes in the cluster may query the node for the files in `/home/naming`. If all conditions for the cluster remain the same, including DHCP assignmens, local copies of the files might provide enough information for operations to be set up and run. Otherwise, `cluster-names` may rebuild address table and query the master node for his neighbor addresses.


<a name='cluster-names' /> </a>
### [cluster-names](#cluster-names-detail)

This command line program queries a LAN for IP addresses. It then attempts to fetch a file using `scp` to see if there is a file indicating a name and other information for use in building a table of hosts that will be part of the cluster. Once the table is built it may be imported into the file `all-machines.conf` which is expected by `bash-file-gen`.


<a name='bash-file-gen' /> </a>
### [bash-file-gen](#bash-file-gen-detail)

This is command line program reads a configuration file `all-machines.conf` which must be in the directory from which the bash command line is used. The command takes no parameters on the command line, as it uses only the configuration file. The structure and format of the file is explained in the section **command file format**

The process described by the configuration file is one that generates a number of bash command files that may be run on LAN nodes and remotes via the master node and ssh. The files may be generated for all nodes in the LAN to perform installations, and setups. Also, each node may be given custom commands. (The configuration file format provides node by node sections for particular operations requiring more than one node.)

## details

In the sections below, further details are given for each of the commands. Some sections may link to other files with description, examples and tutorials for the commands.

* [get-cluster-info](#cluster-info-detail)
* [put-cluster-names](#put-cluster-names-detail)
* [cluster-names](#cluster-names-detail)
* [bash-file-gen](#bash-file-gen-detail)


<a name='cluster-info-detail' /> </a>
## using `get-cluster-info `
[&uArr; back to overview](#cluster-info)


This command knows of, at least, one cluster master. The master is not set up as a continuous controller of nodes, but acts as the first point of address when using `ssh`. The controlled will then use ssh to carry operations forward to internal LAN nodes and to extra nodes

This command causes command files to be ported to the master which are then use to deal with running `ssh` and `scp` command and providing password and fingerprint responses. 

This command first uses its `ssh` bashfile and `expect` framework to create a directory `/home/naming` on each node. This directory becomes the place where files will be stored so that commands used later can obtain coalesced and costomized information in order to how to use the nodes.

The second thing this command does is to gather information about each node having to do with CPU cores, disk drives, and RAM availability. 

The administrator using the results of this tool can set the application name of the nodes by editing the files that this command deposits in a local directory `named-machines` that makes in its working directory. Later, the next command, put-cluster-names, will store the update files on the node disks under `/home/naming`. 

> The step this tool provide needs to be done, but does use some user input including input about external nodes. The tool will ask a user if the nodes returned in its query are to be included in further operations. 
> 
> Later tools may seem reduntant because information may already be on disk. But, it is possible that the files may change by the operations of more than one agent. Or, the requirement of local storage of information my be compromized. Finally, it is possible that IPs will change because of DHCP. So, there will be a way to reconstruct the current state of node roles after such changes.
> 
> The aim is to make it so that `cluster-names` will adapt to network changes when updating exising configurations of cluster nodes.



<a name='put-cluster-names-detail' /> </a>
## using `put-cluster-names`
[&uArr; back to overview](#put-cluster-names)



<a name='cluster-names-detail' /> </a>
## using `cluster-names`
[&uArr; back to overview](#cluster-names)



A run might look like the following:

```
$pwd 
~/my-dir/
$ls
all-machines.conf
$cluster-names cn.conf
$ls
all-machines.conf cluster-data.bfg
```

The extension 'bfg' may be used to indicate that the file has a special format for use by **bash-file-gen**

Here, `cn.conf` is a local file that contains password and user name pairs for tries on the IPs. (more below)




### preparation 

Each host will have a JSON formatted file under the /home directory. The first step is to put it there. Because installations of Linux may result in the same common name among machines, it helps to just give each machine a name that can be used in naming custom configuration files or in identifying it sections of installation templates. The naming information may be the same in different clusters for machines that have the same function within a cluster.

After installing the name information on each cluster, one configuration file will have to be prepared. The file will be a local file that contains password and user name pairs for tries on the IPs. The program will make attempts on the IPs ad may use partial IP matching to guess which password and user to try on an IP. One reason to use the partial matching is that DHCP may change the final parts of octets. Another reason might be to keep some scant security in not revealing the full address with the password even though the file might live shortly within the directory of operation and be deleted after its first use.

**Preparations steps:**

TBD

### focusing and running

`cluster-names` will sniff out the network using nmap. Once it has a list of IPs to examine, it will attempt to get the target file from home directories.

<a name='bash-file-gen-detail' /> </a>
## using `bash-file-gen`
[&uArr; back to overview](#bash-file-gen)



The following is possible:
```
$pwd 
~/my-dir/
$ ls
all-machines.conf
$bash-file-gen
$bfg
```

The last two lines are the same. After running the command, the directories and files specified in the `all-machines.conf` should be available for use.





## command file format

The format of the template command file is custom. Yet, it is fairly simplistic. It is not calculating, just substituting. A short description is provided here.



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
 
 
 
 
