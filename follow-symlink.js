// LANG: JScript
/**
 * あふｗ で Cygwin のシンボリックリンクを扱うためのスクリプト
 *
 * Version: 1.1
 * License: MIT
 * URI: https://github.com/m4i/afx-tools
 *
 * 利用例
 *
 * 1. このファイルを AFXW.EXE と同じディレクトリに置く
 * 2. 同じディレクトリに AFXW.KEY というファイルを作成し以下の内容を記述する
 * ----
 * [KEYCUST]
 * ON=1
 * [NORMAL]
 * K0000="0913:0013"
 * K0001="1913:1013"
 * K0002="2913:2013"
 * K0003="0969:0069"
 * K0004="0986:0086"
 * K0005="0013&SCRIPT $~/follow-symlink.js ENTER "$F""
 * K0006="1013&SCRIPT $~/follow-symlink.js SHIFT-ENTER "$F""
 * K0007="2013&SCRIPT $~/follow-symlink.js CTRL-ENTER "$F""
 * K0008="0069&SCRIPT $~/follow-symlink.js E "$F"
 * K0009="0086&SCRIPT $~/follow-symlink.js V "$F"
 * ----
 *
 * これで Cygwin のシンボリックリンクにカーソルを合わせて
 * ENTER, S-ENTER, C-ENTER, E, V キーを押下したときに、
 * 通常のファイルと同じような動作になります。
 *
 * 他にも色々とできますので詳しくは
 * USAGE, AFXWCFG.TXT, AFXWKEY.TXT を読んでください
 */

var USAGE = [
'Usage: &SCRIPT /path/to/follow-symlink.js [command] "$F"                    ',
'                                                                            ',
'Commands:                                                                   ',
'  ENTER                 ENTER をエミュレートする                            ',
'  ENTER-CD              symlink は &CD。それ以外は "ENTER" と同じ           ',
'  SHIFT-ENTER           SHIFT + ENTER をエミュレートする                    ',
'  CTRL-ENTER            CTRL + ENTER をエミュレートする                     ',
'  E                     E キーをエミュレートする                            ',
'  V                     V キーをエミュレートする                            ',
'  &EXEC/&CD/&CLIP/...   ファイルを引数にあふの内部命令を実行する            ',
'  (任意の文字列)        ファイルを引数に任意のプログラムを実行する          ',
'  (なし)                ファイルを実行ファイルとして実行する                ',
''
];

var ATTRIBUTES = {
  System: 4
};
var IOMODE = {
  ForReading: 1
};
var FORMAT = {
  TristateTrue: -1
};

var FSO = new ActiveXObject('Scripting.FileSystemObject');

/**
 * help を表示
 */
function show_help() {
  for (var i = 0; i < USAGE.length; ++i) {
    Afxw.MesPrint(USAGE[i].replace(/\s+$/, ''));
  }
}

/**
 * スクリプト引数を解析
 */
function parse_arguments() {
  var length, index, command, path;
  switch (length = WScript.Arguments.length) {
  case 0:
    show_help();
    WScript.Quit();
    break;

  case 1:
    path = WScript.Arguments(0);
    break;

  default:
    command = '';
    for (var index = 0; index < length - 1; ++index) {
      if (index > 0) command += ' ';
      var arg = WScript.Arguments(index);
      command += /\s/.test(arg) ? '"' + arg + '"' : arg;
    }
    path = WScript.Arguments(index);
    break;
  }

  return { command: command, path: path };
}

/**
 * `command`
 */
function exec(command) {
  var exec = new ActiveXObject("WScript.Shell").Exec(command);
  while (exec.Status == 0) WScript.Sleep(100);
  return exec.StdOut.ReadAll();
}

/**
 * cygpath -w の結果をできるだけ cygpath コマンドを使わずに取得する
 */
function cygpath_w(unix_path) {
  var regex = /^\/cygdrive\/([a-z])\//i;

  // 相対パス or /cygdrive/*
  if (unix_path.slice(0, 1) != '/' || regex.test(unix_path)) {
    return unix_path.replace(regex, function(_, drive) {
      return drive.toUpperCase() + ':/';
    }).replace(/\//g, '\\');

  // その他
  } else {
    return exec('cygpath -w "' + unix_path + '"').replace(/\s+$/, '');
  }
}

/**
 * dereference symbolic link
 */
function dereference(path) {
  try {
    var file = FSO.GetFile(path);
    if (file.Attributes & ATTRIBUTES.System) {
      var text = file.OpenAsTextStream(IOMODE.ForReading, FORMAT.TristateTrue);
      if (text.read(6) == '\u3c21\u7973\u6c6d\u6e69\u3e6b\ufeff') {
        return cygpath_w(text.ReadAll().slice(0, -1));
      }
    }
  } catch(e) {}
  return null;
}

/**
 * symbolic link 先が見つからないときにエラーを出力して終了する
 */
function symlink_missing(path) {
  Afxw.MesPrint('"' + path + '": No such file or directory');
  WScript.Quit();
}

/**
 * main
 */
(function() {
  var args    = parse_arguments();
  var command = args.command;
  var path    = args.path;

  switch (command) {
  case 'ENTER':
    if (path = dereference(path)) {
      if (FSO.FolderExists(path)) {
        command = '&CD';
      } else if (FSO.FileExists(path)) {
        command = '&VIEW';
      } else {
        symlink_missing(path);
      }
    } else {
      command = '&SENDKEY 0913'
    }
    break;

  case 'ENTER-CD':
    if (path = dereference(path)) {
      if (FSO.FolderExists(path) || FSO.FileExists(path)) {
        command = '&CD';
      } else {
        symlink_missing(path);
      }
    } else {
      command = '&SENDKEY 0913'
    }
    break;

  case 'SHIFT-ENTER':
    if (path = dereference(path)) {
      if (FSO.FolderExists(path)) {
        command = '&CD';
      } else if (FSO.FileExists(path)) {
        command = '&EDIT';
      } else {
        symlink_missing(path);
      }
    } else {
      command = '&SENDKEY 1913'
    }
    break;

  case 'CTRL-ENTER':
    if (path = dereference(path)) {
      if (FSO.FolderExists(path) || FSO.FileExists(path)) {
        command = '&EXEC';
      } else {
        symlink_missing(path);
      }
    } else {
      command = '&SENDKEY 2913'
    }
    break;

  case 'E':
    if (path = dereference(path)) {
      if (FSO.FolderExists(path)) {
        WScript.Quit();
      } else if (FSO.FileExists(path)) {
        command = '&EDIT';
      } else {
        symlink_missing(path);
      }
    } else {
      command = '&SENDKEY 0969'
    }
    break;

  case 'V':
    if (path = dereference(path)) {
      if (FSO.FolderExists(path)) {
        WScript.Quit();
      } else if (FSO.FileExists(path)) {
        command = '&VIEW';
      } else {
        symlink_missing(path);
      }
    } else {
      command = '&SENDKEY 0986'
    }
    break;

  default:
    path = dereference(path) || path;
    break;
  }

  if (command == '&CD' && FSO.FolderExists(path) && path.slice(-1) != '\\') {
    path += '\\';
  }

  if (!command) command = '';
  if (path) {
    if (command) command += ' ';
    command += command == '&CLIP ' ? path : '"' + path + '"';
  }

  Afxw.Exec(command);
})();
