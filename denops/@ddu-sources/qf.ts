import {
  BaseSource,
  Item,
  SourceOptions,
} from "https://deno.land/x/ddu_vim@v2.2.0/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v2.2.0/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.3.2/file.ts";
import { equal } from "https://deno.land/x/equal@v1.5.0/mod.ts";

type Params = {
  loc: boolean;
  what: What;
  withTitle: boolean;
  sep: string;
};

type QuickFix = {
  id: number;
  items: QuickFixItem[];
  bufnr: number;
  col: number;
  lnum: number;
  title: string;
};

type QuickFixItem = {
  bufnr: number;
  col: number;
  lnum: number;
  text: string;
};

type What = {
  bufnr?: number;
  col?: number;
  id?: number;
  lnum?: number;
  title?: string;
};

export class Source extends BaseSource<Params> {
  override kind = "file";

  override gather(args: {
    denops: Denops;
    sourceOptions: SourceOptions;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream<Item<ActionData>[]>({
      async start(controller) {
        // getlistid
        let titleid = -1;
        for (
          let i = (await (fn.getqflist(args.denops, {
            nr: "$",
            id: 0,
          })) as QuickFix).id as number;
          0 < i;
          i--
        ) {
          const what = await (args.sourceParams.loc
            ? fn.getloclist(args.denops, {
              ...args.sourceParams.what,
              ...{ id: i },
            }, 0)
            : fn.getqflist(args.denops, {
              ...args.sourceParams.what,
              ...{ id: i },
            })) as QuickFix;
          if (
            equal(
              args.sourceParams.what,
              (({ id, ...rest }) => rest)(what),
            )
          ) {
            console.log("get!");
            titleid = i;
          }
        }

        if (titleid < 0) {
          controller.close();
        }

        const qflist = await (args.sourceParams.loc
          ? fn.getloclist(args.denops, { items: titleid }, 0)
          : fn.getqflist(args.denops, { items: titleid })) as QuickFix;
        // create items
        const items: Item<ActionData>[] = [];
        const regexp = new RegExp(/(\s|\t|\n|\v)+/g);
        for (const citem of qflist.items) {
          let text: string = citem.text.replaceAll(regexp, " ");
          if (args.sourceParams.withTitle) {
            text = (await fn.bufname(args.denops, citem.bufnr) +
              args.sourceParams.sep + text).replaceAll(regexp, " ");
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
      loc: false,
      what: {},
      withTitle: true,
      sep: "|",
    };
  }
}
