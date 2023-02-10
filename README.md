# ddu-source-qf

quick fix source for ddu.vim

# Required

## denops.vim

https://github.com/vim-denops/denops.vim

## ddu.vim

https://github.com/Shougo/ddu.vim

## ddu-kind-file

https://github.com/Shougo/ddu-kind-file

# Example

```
" LaTeX
call ddu#start(#{sources: [#{name: 'qf',
		\ params: #{what: #{title: 'Diagnostics'}},
		\ #{name: 'qf',
		\ params: #{what: #{title: 'VimTeX'},
		\ 	    isSubst: v:true}}]})

" vimgrep
call ddu#start(#{sources: [
		\ #{name: 'qf',
		\ params: #{what: #{title: ':vimgrep'},
		\ 	    isSubst: v:true,
		\ 	    dup: v:true}},
		\ #{name: 'qf',
		\ params: #{what: #{title: ':lvimgrep'},
		\ 	    isSubst: v:true,
		\ 	    nr: 0,
		\ 	    dup: v:true}}]})
```
