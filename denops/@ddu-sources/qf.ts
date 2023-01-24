import { BaseSource, Item } from "https://deno.land/x/ddu_vim@v2.2.0/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v2.2.0/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.3.2/file.ts";

export class Source extends BaseSource<Params> {
  override kind = "file";
  override gather(args :{
      denops: Denops;
  }): ReadableStream<Item<ActionData>[]>{
    return new ReadableStream<Item<ActionData>[]>({
      async start(controller) {
        const clist = await fn.getqflist(args.denops) as Array<string>;
        let items:  Item<ActionData>[] = [];
        for(let citem of clist){
            items.push({
                word: await fn.bufname(args.denops, citem.bufnr) + ":" + citem.text,
                action: {
                    path: await fn.bufname(args.denops, citem.bufnr)
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
    };
  }
}
