import { BaseSource, Item, SourceOptions } from "https://deno.land/x/ddu_vim@v2.2.0/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v2.2.0/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.3.2/file.ts";

type Params = {
   "loc": boolean; 
   "fromDiagnostics" : boolean;
}

export class Source extends BaseSource<Params> {
  override kind = "file";
  override gather(args :{
      denops: Denops;
      sourceOptions: SourceOptions;
      sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]>{
    return new ReadableStream<Item<ActionData>[]>({
      async start(controller) {
        // setqflist 
        if (args.sourceParams.fromDiagnostics) {
            if (args.sourceParams.loc) {
                if (await args.denops.call("has", "nvim")) {
                    // nvim built-in lsp
                    args.denops.cmd("lua vim.diagnostic.setloclist({open=false})");
                } else {
                    // vim-lsp
                    // maybe have to use internal functions
                    // meemo :: This script not working
                    //args.denops.cmd("LspDocumentDiagnostics");
                    //args.denops.cmd("lclose");
                }
            } else {
                if (await args.denops.call("has", "nvim")) {
                    // nvim built-in lsp
                    args.denops.cmd("lua vim.diagnostic.setqflist({open=false})");
                } else {
                    console.log("test")
                    // vim-lsp
                    // maybe have to use internal functions
                    // memo :: This script not working
                    //args.denops.cmd("LspDocumentDiagnostics");
                    //fn.setqflist(args.denops, fn.getloclist(args.denops, 0));
                    //args.denops.cmd("lclose");
                }
            }
        }

        // getlist
        const clist = await (args.sourceParams.loc ? fn.getloclist(args.denops, 0) :  fn.getqflist(args.denops));

        // create items
        const items: Item<ActionData>[] = [];
        const regexp = new RegExp(/(\s|\t|\n|\v)+/g);
        for(const citem of clist){
            console.log(citem)
            items.push({
                word: (await fn.bufname(args.denops, citem.bufnr) + ":" + citem.text).replaceAll(regexp, " "),
                action: {
                    path: await fn.bufname(args.denops, citem.bufnr),
                    bufNr: citem.bufnr,
                    lineNr: citem.lnum,
                },
            });
        }
        controller.enqueue(items);
        controller.close();
      },
    });
  }

  override params(): Params {
    return {
        "loc" : false,
        "fromDiagnostics" : false,
    };
  }
}
