const fs = require('fs')
const minify = require('html-minifier').minify;
const tar = require('tar')
const {exec} = require('child_process')
 
const scp = require('node-scp')


var g_releaseObject = null

function load_release_json(json_file) {
    try {
        var releaseObj_str = fs.readFileSync(json_file,'ascii').toString()
        try {
            g_releaseObject = JSON.parse(releaseObj_str)
        } catch (e) {
            console.error("failed to parse the file 'release.json'")
            console.error(e)
            process.exit(0) 
        }
    } catch (e) {
        console.error("failed to find the file 'release.json'")
        process.exit(0)
    }
    
    console.dir(g_releaseObject)
    return(g_releaseObject)    
}


// // // // // // // // // // 


function extract_vars(rm_ctl_tmpl) {
    let varset = []
    let parts = rm_ctl_tmpl.split('${')
    if ( parts.length ) {
        for ( let i = 1; i < parts.length; i++ ) {
            let var_head = parts[i]
            var_head = var_head.substr(0,var_head.indexOf('}'))
            varset.push(var_head)
        }
    }
    return varset
}


function subst_vars(tmplt,srcObj) {
    let var_list = extract_vars(tmplt)
    let result = [tmplt]
    if ( var_list.length ) {
        var_list.forEach(aVar => {
            let value = srcObj
            let vaccess = aVar.split('.')
            while ( vaccess.length ) {
                let key = vaccess.shift()
                if ( ( key === '$keys()' ) && ( typeof value === 'object' ) ) {
                    if ( value.length ) {
                        let vstore = []
                        value.forEach(val => {
                            for ( let k in val ) {
                                vstore.push(val[k])
                            }    
                        })
                        value = vstore
                    } else {
                        let vstore = []
                        for ( let k in value ) {
                            vstore.push(value[k])
                        }
                        value = vstore    
                    }
                } else {
                    if ( ( typeof value === 'object' ) && value.length ) {
                        let nvalue = value.map(vobj => {
                            return(vobj[key] !== undefined ? vobj[key] : '' )
                        })
                        value = nvalue
                    } else {
                        value = value[key]
                    }
                }
            }
            if ( typeof value === 'string' ) {
                let finalResult = result.map( rtmplt => rtmplt.replace('${' + aVar + '}',value) )
                result = finalResult
            } else if ( ( typeof value === 'object' ) && value.length ) {
                let nresult = []
                value.forEach(val => {
                    let finalResult = result.map( rtmplt => rtmplt.replace('${' + aVar + '}',val) )
                    nresult = nresult.concat(finalResult)       
                })
                result = nresult
            }
        })
    }
    return(result)
}

function extracToVar(replVar,head_region,tail_region,fileString) {
    let results = ['','']
    //   
    let [header,rest] = fileString.split(head_region,2)
    let end_parts = rest.split(tail_region)
    //
    console.log(end_parts.length)
    let salvaged = end_parts.shift()
    let backend = end_parts.join(tail_region)
    //
    results[0] = header + replVar + backend
    results[1] = salvaged
    //
    return(results)
}

function compress_html_file(compressable) {
    let result = minify(compressable, {
        removeAttributeQuotes: false,
        caseSensitive : true,
        collapseWhitespace : true,
        conservativeCollapse : true,
        html5 : true,
        keepClosingSlash : true,
        minifyCSS : true,
        minifyJS : true,
        sortClassName : true
      });
    return result
}

// var g_siteURL = "localhost";
function prepareHtmlFile(filePath,dmn) {
    //
    let url = dmn
    /// 
    let fileString = fs.readFileSync(filePath,'utf8').toString()
    //
    let pure_region_spec = g_releaseObject.dont_compress
    let replVar = pure_region_spec.replace_var
    let head_region = pure_region_spec.match_head
    let tail_region = pure_region_spec.match_tail

    let [compressable,salvaged] = extracToVar(replVar,head_region,tail_region,fileString)
    //
    salvaged = head_region + salvaged + tail_region
    //
    fileString = compress_html_file(compressable)
    fileString = fileString.replace('var g_siteURL = "localhost";',`var g_siteURL = "${url}";`)
    fileString = fileString.replace('var g_siteURL = "localhost";',`var g_siteURL = "${url}";`)
    fileString = fileString.replace(replVar,salvaged)
    //
    fs.writeFileSync(filePath,fileString)
}

function process_remote_control() {
    return(subst_vars(g_releaseObject.remote_control,g_releaseObject)[0])
}

/*
// testing for future ref... ignore
function process_remote_locations() {
    return(subst_vars(g_releaseObject.remote_html,g_releaseObject))
}
function process_micro_servs_locations() {
    return(subst_vars(g_releaseObject.remote_micros,g_releaseObject))
}
// // // // // // // // // // // // // // // //
var rm_command = process_remote_control()
console.log(rm_command)

var rm_locations = process_remote_locations()
console.log(rm_locations)

var micros_locations = process_micro_servs_locations()
console.log(micros_locations)
*/



function ensureExists(path, mask) {
    if (typeof mask == 'undefined') { // allow the `mask` parameter to be optional
        cb = mask;
        mask = 0777;
    }
    var p = new Promise((resolve,reject) => {
        fs.mkdir(path, mask, function(err) {
            if (err) {
                if (err.code == 'EEXIST') resolve(null); // ignore the error if the folder already exists
                else reject(err); // something else went wrong
            } else resolve(null); // successfully created folder
        });

    })
    return p
}


async function stage_html() {
    let releaseDir = g_releaseObject.staging.folder
    try {
        await ensureExists('./' +  releaseDir)
        Object.keys(g_releaseObject.domains).forEach (async dmn => {
            try {
                await ensureExists('./' +  releaseDir + '/' + dmn)
                let directive = g_releaseObject.domains[dmn]
                let srcpath = directive.html.from
                let filename = directive.html.file + ".html"
                fs.copyFileSync(srcpath + '/' + filename,'./' +  releaseDir + '/' + dmn + '/' + filename)
                try {
                    prepareHtmlFile('./' +  releaseDir + '/' + dmn + '/' + filename,dmn)
                } catch (e) {
                    console.error(e)
                }
            } catch (e) {
                console.error(e)
            }
        })
    } catch(e) {
        console.error(e)
    }
}


async function stage_micros() {
    //
    let releaseDir = g_releaseObject.staging.folder
    try {
        await ensureExists('./' +  releaseDir)
        Object.keys(g_releaseObject.domains).forEach (async dmn => {
            try {
                await ensureExists('./' +  releaseDir + '/' + dmn)
                await ensureExists('./' +  releaseDir + '/' + dmn  + '/home')
                let dest = './' +  releaseDir + '/' + dmn  + '/home'
                //
                let directive = g_releaseObject.domains[dmn]
                let srcpath = directive.micros.from
                let file_list = directive.micros.files
                //
                file_list.forEach(async filename => {
                    let path = srcpath + '/' + filename
                    fs.copyFileSync(path,dest + '/' + filename)
                })
                //
                let node_modules_src = srcpath + '/node_modules'
                let module_dest = dest + '/node_modules'
                await ensureExists(module_dest)
                //
                let special_node_modules = g_releaseObject.staging.special_node_modules
                special_node_modules.forEach(async mod => {
                    await ensureExists(module_dest + `/${mod}`)
                    let mod_dest_file = `/${mod}/index.js`
                    fs.copyFileSync(node_modules_src + mod_dest_file,module_dest + mod_dest_file)
                })
                //
                let spec_content_list =  g_releaseObject.staging.special_content
                spec_content_list.forEach(spc_content => {
                    let file = spc_content.file
                    let content_txt = spc_content.text
                    fs.writeFileSync(dest + `/${file}`,content_txt)
                })
                //                
            } catch (e) {
                console.error(e)
            }
        })
    } catch(e) {
        console.error(e)
    }
}


async function zip_release() {
    let releaseDir = g_releaseObject.staging.folder
    await tar.c(
        {
          gzip: true,
          file: releaseDir + '.tgz'
        },
        [releaseDir]
      )
}

async function upload_release(ssh_pass) {
    let releaseFile = g_releaseObject.staging.folder + '.tgz'
    //let bashline = `scp ${releaseFile} ${dest_machine}:/home`
    //await run_bash(bashline)

    const c = await scp({
        host: g_releaseObject.target.host,
        port: 22,
        username: g_releaseObject.target.user,
        password: `${ssh_pass}`,
    })
    await c.uploadFile(releaseFile, `/home/${g_releaseObject.staging.folder}.tgz`)
    c.close() // remember to close connection after you finish    
}


async function gen_bash_script() {
    //
    let script = ["pushd /home"]
    let releaseDir = g_releaseObject.staging.folder
    //
    script.push(`tar xf ${releaseDir}.tgz`)
    script.push(`rm ${releaseDir}.tgz`)
    Object.keys(g_releaseObject.domains).forEach (dmn => {
        let dw_d = dmn.replace('www.','')
        script.push(`cp  ${releaseDir}/${dmn}/home/*.js ${dw_d}/`)
        script.push(`cp  ${releaseDir}/${dmn}/home/*.html ${dw_d}/`)
        //
        let directive = g_releaseObject.domains[dmn]

        let html_path = g_releaseObject.remote_html

        script.push(`cp  ${releaseDir}/${dmn}/${directive.html.file}.html ${html_path}/${directive.html.subdir}`)
        //
        let src = `${releaseDir}/${dmn}/home/node_modules/`
        let dest = `${dw_d}/node_modules/`
        script.push(`cp -R --no-dereference --preserve=all --force --one-file-system --no-target-directory "${src}" "${dest}"`)
    });
    //
    script.push(`cp  ${releaseDir}/ecosystem.config.js ./`)
    script.push('pm2 start ecosystem.config.js')
    script.push('popd')
    //
    let out_script = script.join('\n')
    try {
        await ensureExists('./' +  releaseDir)
        fs.writeFileSync('./releaser.sh',out_script)
    } catch(e) {
        console.error(e)
    }
    //
}


function output_ecosystem(ecosystem) {
    // first generate ecosystem
    
    fs.writeFileSync('./ecosystem.config.js',ecosystem)
    let releaseDir = g_releaseObject.staging.folder
    fs.renameSync('./ecosystem.config.js','./' +  releaseDir + '/ecosystem.config.js')
}

function run_releaser() {
    let rm_ctl_command = process_remote_control()
    console.log(rm_ctl_command)
    exec(rm_ctl_command,(err,stdout,stderr) => {
        if ( err ) {
            console.error(stderr)
            console.error(err)
        } else {
            console.log(stdout)
        }
    })
}

// 


class Releaser {
    //
    constructor(ssh_pass,release_json_file,ecosystem) {
        this.ssh_pass = ssh_pass
        this.json_file = release_json_file
        this.ecosystem = ecosystem
    }
    //
    run() {
        load_release_json(this.json_file)
        stage_html()
        stage_micros()
        output_ecosystem(this.ecosystem)
        gen_bash_script()
        zip_release()
        upload_release(this.ssh_pass)
        run_releaser()
    }
}

module.exports=Releaser


///
/*


npm install mime


pm2 ls
pm2 stop 0
pm2 start express-captcha.js
pm2 start express-signup.js.js
pm2 restart 0

# Start all applications
pm2 start ecosystem.config.js

# Start only the app named worker-app
pm2 start ecosystem.config.js --only worker-app

# Stop all
pm2 stop ecosystem.config.js

# Restart all
pm2 start   ecosystem.config.js
## Or
pm2 restart ecosystem.config.js

# Reload all
pm2 reload ecosystem.config.js

# Delete all
pm2 delete ecosystem.config.js

*/