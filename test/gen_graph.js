

let arc_travler = require('../lib/arc-traveler')

class AuthGraphNOde {
    constructor(node_data) {
        if ( node_data ) {
            this.name = node_data.name
            this.depth = node_data.depth
            this.sibs = node_data.sibs
            this.user = node_data.user
            this.pass = node_data.pass
            this.addr = node_data.addr
            this.op_dir = node_data.op_dir
            this.y_fingerprint = node_data.y_fingerprint
            this.backrefs = node_data.backrefs
            this.upload_scripts = node_data.upload_scripts
            this.download_scripts = node_data.download_scripts
            this.ops = node_data.download_scripts
            this.post_ops = node_data.post_ops    
        } else {
            let flds = "name,depth,sibs,user,pass,addr,op_dir,y_fingerprint,backrefs,upload_scripts,download_scripts,ops,post_ops"
            flds = flds.split(',')
            let self = this
            for ( let fld of flds ) {
                self[fld] = ""
            }
        }
    }

    from_csv(line) {
        let data = line.split(',')
        //
        this.name = data[0].trim()
        this.depth = data[1].trim()
        this.sibs = data[2].trim()
        this.user = data[3].trim()
        this.pass = data[4].trim()
        this.addr = data[5].trim()
        this.op_dir = data[6].trim()
        this.y_fingerprint = data[7].trim()
        this.backrefs = data[8].trim()
        // ----                                 the difference between startup and general ops starts here
        this.upload_scripts = data[9].trim()
        this.download_scripts = data[10].trim()
        this.ops = data[11].trim()
        this.post_ops = data[12].trim()
        return this
    }


    to_csv() {
        let flds = "name,depth,sibs,user,pass,addr,op_dir,y_fingerprint,backrefs,upload_scripts,download_scripts,ops,post_ops"
        flds = flds.split(',')
        let self = this
        let values = flds.map( fld => self[fld] )
        let vstr = values.join(',')
        return vstr
    }

}



let host_descrs = []


host_descrs.push((new AuthGraphNOde()).from_csv("here,1,home otw copious popsong,richardalbertleddy,dGVzdDd0ZXN0Cg==,localhost,./arc-ops,1,none,,,,,,"))
host_descrs.push((new AuthGraphNOde()).from_csv("home,2,g_sessions contacts endpoint-users otw-create,richard,dGVzdDR0ZXN0Cg==,76.229.181.242,./arc-ops,1,here,,,,,,"))
host_descrs.push((new AuthGraphNOde()).from_csv("g_sessions,3,none,root,ZGlldHBpCg==,192.168.1.71,/home/arc-ops,0,home here,,,,,,"))
host_descrs.push((new AuthGraphNOde()).from_csv("contacts,3,none,root,ZGlldHBpCg==,192.168.1.75,/home/arc-ops,0,home here,,,,,,"))
host_descrs.push((new AuthGraphNOde()).from_csv("endpoint-users,3,none,root,ZGlldHBpCg==,192.168.1.77,/home/arc-ops,0,home here,,,,,,"))
host_descrs.push((new AuthGraphNOde()).from_csv("otw-create,3,none,root,ZGlldHBpCg==,192.168.1.81,/home/arc-ops,0,home here,,,,,,"))
host_descrs.push((new AuthGraphNOde()).from_csv("otw,2,none,root,TDJ2PTk1JEoscVspNHdGLQo=,45.32.219.78,/home/arc-ops,1,here,,,,,,"))
host_descrs.push((new AuthGraphNOde()).from_csv("copious,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,/home/arc-ops,1,here,,,,,,"))
host_descrs.push((new AuthGraphNOde()).from_csv("popsong,2,none,root,aEg4P29jck0lZ2VibjhNTgo=,155.138.235.197,/home/arc-ops,1,here,,,,,,"))



function output_csv_host_graph(hdscr) {
    let host_lines = hdscr.map(host => host.to_csv())
    let hcsv = host_lines.join('\n')
    return hcsv
}

let xops = require('../lib/exec_ops')


async function main() {
    //
    let hcsv = output_csv_host_graph(host_descrs)
    //console.log(hcsv)
    let ops = ["ls","pwd","date"]
    await arc_travler.start_arc_traveler_setup(host_descrs[0],host_descrs,"arc-ops",ops,"setup_uploader.sh")
}


main()