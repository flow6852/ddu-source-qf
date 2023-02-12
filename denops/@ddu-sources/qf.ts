import {
  BaseSource,
  Item,
  SourceOptions,
} from "https://deno.land/x/ddu_vim@v2.2.0/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v2.2.0/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.3.2/file.ts";
import { isAbsolute } from "https://deno.land/std@0.177.0/path/mod.ts";

type Params = {
  nr: number;
  what: What;
  isSubst: boolean;
  dup: boolean;
  format: string;
};

type QuickFix = {
  items: QuickFixItem[];
  qfbufnr: number;
  nr: number;
  col: number;
  id: number;
  lnum: number;
  title: string;
};

type QuickFixItem = {
  bufnr: number;
  col: number;
  lnum: number;
  text: string;
  type: string;
};

type What = {
  qfbufnr?: number;
  nr?: number;
  col?: number;
  id?: number;
  lnum?: number;
  title?: string;
};

type BufInfo = {
  bufnr: number;
  hidden: boolean;
  loaded: boolean;
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
        // get now bufNr
        // Note: fn.bufexists can't check """ hidden """
        const bufInfos = await fn.getbufinfo(args.denops) as Array<BufInfo>;

        // getlistid
        let titleid = 0;
        for (
          let i = (await (args.sourceParams.nr > -1
            ? fn.getloclist(args.denops, args.sourceParams.nr, {
              nr: "$",
              id: 0,
            })
            : fn.getqflist(args.denops, {
              nr: "$",
              id: 0,
            })) as QuickFix).id as number;
          0 < i;
          i--
        ) {
          // default {what} 
          // if use {all: 0}, `getqflist` get items
          const what: What = {
            id: i,
            nr: 0,
            qfbufnr: 0,
            col: 0,
            lnum: 0,
            title: "",
          };

          const qfl = await (args.sourceParams.nr > -1
            ? fn.getloclist(args.denops, args.sourceParams.nr, what)
            : fn.getqflist(args.denops, what)) as QuickFix;
          if (
            isContain(qfl, args.sourceParams)
          ) {
            titleid = i;

            const qflist = await (args.sourceParams.nr > -1
              ? fn.getloclist(args.denops, args.sourceParams.nr, {
                id: titleid,
                all: 0,
              })
              : args.denops.dispatch("ddu-source-qf", "ddu_source_qf#_getqflist", { id: titleid, all: 0 }, 10)) as QuickFix;
            // create items
            const items: Item<ActionData>[] = [];
            for (const citem of qflist.items) {
            // format text
            const regexp = new RegExp(/(\s|\t|\n|\v)+/g);
              const text: string = args.sourceParams.format.replaceAll(
                regexp,
                " ",
              )
                .replaceAll(
                  "%i",
                  String(qflist.id),
                ).replaceAll(
                  "%b",
                  String(citem.bufnr),
                ).replaceAll(
                  "%c",
                  String(citem.col),
                ).replaceAll(
                  "%l",
                  String(citem.lnum),
                ).replaceAll(
                  "%T",
                  qflist.title,
                ).replaceAll(
                  "%y",
                  citem.type,
                ).replaceAll(
                  "%p",
                  await fn.bufname(args.denops, citem.bufnr),
                ).replaceAll(
                  "%t",
                  citem.text,
                );

              // fullpath
              // Note: fn don't have isabsolutepath
              const path =
                isAbsolute(await fn.bufname(args.denops, citem.bufnr))
                  ? await fn.bufname(args.denops, citem.bufnr)
                  : await fn.getcwd(args.denops) + "/" +
                    await fn.bufname(args.denops, citem.bufnr);

              // set action data
              let item: ActionData = {
                col: citem.col,
                lineNr: citem.lnum,
                path: path,
                text: text,
              };

              // set bufNr
              for (const info of bufInfos) {
                if (info.bufnr == citem.bufnr && info.loaded && !info.hidden) {
                  item = { ...item, ...{ bufNr: info.bufnr } };
                }
              }

              items.push({ word: text, action: item });
            }
            controller.enqueue(items);
            if (!args.sourceParams.dup) {
              break;
            }
          }
        }
        controller.close();
      },
    });
  }

  override params(): Params {
    return {
      nr: -1,
      what: {},
      isSubst: false,
      format: "%T|%t",
      dup: false,
    };
  }
}

function isContain(qf: QuickFix, src: Params) {
  let ret = true;
  for (const key of Object.keys(src.what)) {
    switch (key) {
      case "qfbufnr":
        ret = ret && (qf.qfbufnr == src.what.qfbufnr);
        break;
      case "nr":
        ret = ret && (qf.nr == src.what.nr);
        break;
      case "col":
        ret = ret && (qf.col == src.what.col);
        break;
      case "id":
        ret = ret && (qf.id == src.what.id);
        break;
      case "lnum":
        ret = ret && (qf.lnum == src.what.lnum);
        break;
      case "title":
        ret = ret &&
          (src.isSubst
            ? (!qf.title.indexOf(src.what.title as string))
            : (qf.title == src.what.title));
        break;
    }
  }
  return ret;
}
