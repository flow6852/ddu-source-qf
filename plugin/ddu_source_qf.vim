function ddu_source_qf#_getqflist(what, end) abort
    let qflist =  getqflist(a:what)[: a:end]
    let qflist.items = qflist.items[: a:end]
    return qflist
endfunction

function ddu_source_qf#_getloclist(nr, what, end) abort
    let qflist = getloclist(a:nr, a:what)[: a:end]
    let qflist.items = qflist.items[: a:end]
    return qflist
endfunction
