import { BaseSource, Item, SourceOptions } from "https://deno.land/x/ddu_vim@v2.2.0/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v2.2.0/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.3.2/file.ts";

type Params = {
   "loc": boolean; 
   "title": string;
   "withTitle": boolean;
   "sep": string;
}

type QfHistId = {
    "title": string;
    "qfids": number[];
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
        // getlistid
        let titleid = 0;
        for (let i = (await(fn.getqflist(args.denops, {"id": 0}))).id as number; 0 < i; i--){
            const title = await (args.sourceParams.loc ?
                                 fn.getloclist(args.denops, {"title": i}, 0) :
                                 fn.getqflist(args.denops, {"title": i}));
            if (title.title === args.sourceParams.title) {
                titleid = i;
            }
        }
        const qflist = await (args.sourceParams.loc ?
                             fn.getloclist(args.denops, {"items":  titleid}, 0) :
                             fn.getqflist(args.denops, {"items": titleid}));

        // create items
        const items: Item<ActionData>[] = [];
        const regexp = new RegExp(/(\s|\t|\n|\v)+/g);
        for(const citem of qflist.items){
            let text: string = citem.text.replaceAll(regexp, " ");
            if (args.sourceParams.withTitle) {
                text = (await fn.bufname(args.denops, citem.bufnr) + args.sourceParams.sep + text).replaceAll(regexp, " ");
            }

            items.push({
                word: text,
                action: {
                    bufNr: citem.bufnr,
                    col: citem.col,
                    lineNr: citem.lnum,
                    path: await fn.bufname(args.denops, citem.bufnr),
                    text: text,
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
        "title" : "",
        "withTitle" : true,
        "sep" : "|",
    };
  }
}
