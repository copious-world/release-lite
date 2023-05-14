const { gulp_section, popout, remove_spaces } = require("./utilities")



class Goal {
    // 
    constructor(formula,depth) {
        this.depth = depth
        this.matcher = remove_spaces(formula)
        this.g_type = popout(matcher,'(')
        this.subgoal_matching = gulp_section(this.matcher,'(',')')
    }

}




module.exports = Goal