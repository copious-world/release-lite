# release-lite

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

