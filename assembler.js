// The MIT License (MIT)
// Copyright (c) 2012 Matt Bell
// Modifications Copyright (c) 2012 Chad Etzel

// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:

// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var Assembler =
  ( function() {

      var opcodes = {
	//assembler directives
	'DAT': null,

	//simple ops
	'SET': 0x01,
	'ADD': 0x02,
	'SUB': 0x03,
	'MUL': 0x04,
	'DIV': 0x05,
	'MOD': 0x06,
	'SHL': 0x07,
	'SHR': 0x08,
	'AND': 0x09,
	'BOR': 0x0a,
	'XOR': 0x0b,
	'IFE': 0x0c,
	'IFN': 0x0d,
	'IFG': 0x0e,
	'IFB': 0x0f,

	//non-simple ops
	'JSR': 0x10,
	'BRK': 0x20
      };

      function Assembler(cpu) {
	this.cpu = cpu;
	this.instructionMap = [];
	this.addressMap = [];
	this.instruction = 0;
      }

      function isWhitespace(character) {
	return ['\n', '\r', '\t', ' '].indexOf(character) !== -1;
      }

      function getToken(string) {
	return string.split(' ')[0].split('\t')[0];
      }

      Assembler.prototype = {
	clean: function(code) {
	  var i, j, line, lineNumber = 1, output = '', op, args, c;
	  code += '\n';
	  while(code.length > 0) {
	    line = code.substr(0, code.indexOf('\n')).split(';')[0];

	    if(code.indexOf('\n') === -1) {
	      break;
	    } else {
	      code = code.substr(code.indexOf('\n') + 1);
	    }
	    op = '';
	    args = [];

	    for(i = 0; i < line.length; i++) {
	      c = line.charAt(i);
	      if(!isWhitespace(c)) {
	        if(c === ';') {
	          break;
	        } else if(c === ':') {
	          output += getToken(line.substr(i)) + ' ';
	          i += getToken(line.substr(i)).length;
	        } else {
	          if(!op) {
	            op = getToken(line.substr(i));
	            i += op.length;
	          } else {
	            var arg;

		    if(line.charAt(i) === '"') {
		      for(j = i + 1; j < line.length; j++) {
			if(line.charAt(j) === '"'
			   && (line.charAt(j-1) !== '\\' || line.charAt(j-2) === '\\')) {
			  arg = line.substring(i, j+1);
			  i = j + 1;
			}
		      }
		      if(!arg) throw new Error('Unterminated string literal');
		    } else {
		      arg = getToken(line.substr(i));
		    }

	            if(arg.charAt(arg.length - 1) === ',') {
	              arg = arg.substr(0, arg.length - 1);
	              i++;
	            }
	            i += arg.length;

	            args.push(arg);
	          }
	        }
	      }
	    }

	    if(op) {
	      output += op;
	      var len = args.length;
	      for(i = 0; i < len; i++) output += ' ' + args[i];
	      output += '\n';

	      this.instructionMap.push(lineNumber);
	    }
	    lineNumber++;
	  }
	  return output + '\n';
	},
	compile: function(code) {
	  this.instruction = 0;
	  code = this.clean(code);

	  var i, j, address = 0;
	  var subroutineQueue = [], subroutines = {};
	  var cpu = this.cpu, value, words, operand, line, op, args, sr, c;
	  var mem = [];
	  var prevline = null;

	  function isRegister(s) {
	    switch(s) {
	    case 'a': case 'b': case 'c': case 'x': case 'y': case 'z':
	    case 'i': case 'j': case 'pc': case 'sp': case 'o':
	      return true;
	    default:
	      return false;  
	    }
	    return false;
	  }

	  function pack(value) {
	    if(opcodes[op] !== null) words[0] += value << (4 + operand * 6);
	  }

	  function parse(arg) {
	    arg = arg.replace('\t', '').replace('\n', '');

	    var pointer = false, offset;
	    if(arg.charAt(0) === '[' && arg.charAt(arg.length - 1) === ']') {
	      pointer = true;
	      arg = arg.substring(1, arg.length - 1);
	    }

	    //string literal
	    if(arg.charAt(0) === '"' && arg.charAt(arg.length - 1) === '"') {
	      arg = arg.substr(1, arg.length - 2);
	      for(j = 0; j < arg.length; j++) {
	        var character;
	        if(arg.charAt(j) === '\\') {
	          switch(arg.charAt(j+1)) {
	          case 'n': character = 10; break;
	          case 'r': character = 13; break;
	          case 'a': character = 7; break;
	          case '\\': character = 92; break;
	          case '"': character = 34; break;
	          case '0': character = 0; break;
	          default: throw new Error('Unrecognized string escape (\\'
	                		   + arg.charAt(j+1) + ')');
	          }
	          j++;
	        } else {
	          character = arg.charCodeAt(j);
	        }

	        if(opcodes[op] !== null) pack(0x1f);
	        words.push(character);
	      }
	    }

	    //next word + register
	    else if(pointer && arg.split('+').length === 2
		    && typeof arg.split('+')[1] === 'string'
		    //&& typeof mem[arg.split('+')[1].toLowerCase()] === 'number') {
		    && isRegister(arg.split('+')[1].toLowerCase())) {
	      switch (arg.split('+')[1].toLowerCase()) {
	      case 'a':
	        pack(0x10);
	        break;
	      case 'b':
	        pack(0x11);
	        break;
	      case 'c':
	        pack(0x12);
	        break;
	      case 'x':
	        pack(0x13);
	        break;
	      case 'y':
	        pack(0x14);
	        break;
	      case 'z':
	        pack(0x15);
	        break;
	      case 'i':
	        pack(0x16);
	        break;
	      case 'j':
	        pack(0x17);
	        break;
	      }

	      if(parseInt(arg.split('+')[0]) || parseInt(arg.split('+')[0]) === 0) {
	        var offset = parseInt(arg.split('+')[0]);

		if(offset < 0 || offset > 0xffff) {
		  throw new Error('Invalid offset [' + arg + '], must be between 0 and 0xffff');
		}

	        words.push(offset);
	      } else {
	        subroutineQueue.push({
		                       id: arg.split('+')[0],
		                       address: address + words.length
				     });
		words.push(0x0000);
	      }
	    }

	    //literals/pointers
	    else if(parseInt(arg) || parseInt(arg) === 0) {
	      value = parseInt(arg);

	      if(value < 0 || value > 0xffff) {
	        throw new Error('Invalid value 0x' + value.toString(16) + ', must be between 0 and 0xffff');
	      }

	      //0x20-0x3f: literal value 0x00-0x1f (literal)
	      if(value <= 0x1f && opcodes[op] !== null) {
	        pack(value + 0x20);
	      } else {
	        //0x1e: [next word]
	        if(pointer) {
	          pack(0x1e);
	        } else {
	          //0x1f: next word (literal)
	          pack(0x1f);
	        }

	        words.push(value);
	      }
	    }

	    //other tokens
	    else {
	      switch (arg.toLowerCase()) {
	        //0x00-0x07: register (A, B, C, X, Y, Z, I or J, in that
	        // order)
	        //0x08-0x0f: [register]
	      case 'a':
	        if(!pointer) {
	          pack(0x00);
	        } else {
	          pack(0x08);
	        }
	        break;
	      case 'b':
	        if(!pointer) {
	          pack(0x01);
	        } else {
	          pack(0x09);
	        }
	        break;
	      case 'c':
	        if(!pointer) {
	          pack(0x02);
	        } else {
	          pack(0x0a);
	        }
	        break;
	      case 'x':
	        if(!pointer) {
	          pack(0x03);
	        } else {
	          pack(0x0b);
	        }
	        break;
	      case 'y':
	        if(!pointer) {
	          pack(0x04);
	        } else {
	          pack(0x0c);
	        }
	        break;
	      case 'z':
	        if(!pointer) {
	          pack(0x05);
	        } else {
	          pack(0x0d);
	        }
	        break;
	      case 'i':
	        if(!pointer) {
	          pack(0x06);
	        } else {
	          pack(0x0e);
	        }
	        break;
	      case 'j':
	        if(!pointer) {
	          pack(0x07);
	        } else {
	          pack(0x0f);
	        }
	        break;

	        //0x18: POP / [SP++]
	      case 'sp++':
	      case 'pop':
	        pack(0x18);
	        break;

	        //0x19: PEEK / [SP]
	      case 'sp':
	        if(pointer) {
	          pack(0x19);
	        } else {
	          pack(0x1b);
	        }
	        break;
	      case 'peek':
	        pack(0x19);
	        break;

	        //0x1a: PUSH / [--SP]
	      case '--sp':
	      case 'push':
	        pack(0x1a);
	        break;

	        //0x1c: PC
	      case 'pc':
	        pack(0x1c);
	        break;

	        //0x1d: O
	      case 'o':
	        pack(0x1d);
	        break;

	      default:
	        if(arg) {
	          pack(0x1f);
	          subroutineQueue.push({
					 id: arg,
					 address: address + words.length
				       });
	          words.push(0x0000);
	        }
	        break;
	      }
	    }
	    operand++;
	  }

	  while(code.length > 0) {
	    line = code.substr(0, code.indexOf('\n'));
	    op = undefined,
	    args = [];

	    if(code.indexOf('\n') === -1) {
	      break;
	    } else {
	      code = code.substr(code.indexOf('\n') + 1);
	    }

	    for( i = 0; i < line.length; i++) {
	      c = line.charAt(i);
	      if(c === ':') {
	        subroutines[getToken(line.substr(i + 1))] = address;
	        i += getToken(line.substr(i)).length;
	      } else if(typeof op === 'undefined') {
	        op = getToken(line.substr(i)).toUpperCase();
	        i += op.length;
	      } else {
	        var arg;

	        if(line.charAt(i) === '"') {
		  for(j = i + 1; j < line.length; j++) {
		    if(line.charAt(j) === '"'
		       && (line.charAt(j-1) !== '\\' || line.charAt(j-2) === '\\')) {
		      arg = line.substring(i, j+1);
		      i = j + 1;
		    }
		  }
		  if(!arg) throw new Error('Unterminated string literal');
	        } else {
                  arg = getToken(line.substr(i));
                }

                if(arg.charAt(arg.length - 1) === ',') {
                  arg = arg.substr(0, arg.length - 1);
                  i++;
                }
                i += arg.length;

                args.push(arg);

                if((opcodes[op] > 0xff && args.length > 1)
		  || (opcodes[op] !== null && args.length > 2)) {
                  throw new Error('Invalid amount of arguments for op ' + op);
                }
              }
	    }

	    if(typeof op !== 'undefined') {
	      if(typeof opcodes[op] !== 'undefined') {
	        if(opcodes[op] !== null) words = [opcodes[op]];
	        else words = [];

	        operand = 0;

	        if(words[0] > 0xf) {
	          operand++;
	        }

	        for(i = 0; i < args.length; i++) {
	          parse(args[i]);
	        }

		var preAddr = address;
	        for(j = 0; j < words.length; j++) {
		  var linep = (line == prevline) ? "" : line;
		  prevline = line;
		  var print = hex(words[j]) + "  " + (linep ? hex(address) : "") + "  " + linep;
	          mem[address++] = print;
	        }
	        var postAddr = address;

	        for(i = preAddr; i <= postAddr; i++) {
	          this.addressMap[i] = this.instructionMap[this.instruction];
	        }

	        this.instruction++;
	      } else {
	        throw new Error('Invalid opcode (' + op + ')');
	      }
	    }
	  }

	  for( i = 0; i < subroutineQueue.length; i++) {
	    sr = subroutineQueue[i];
	    if( typeof subroutines[sr.id] === 'number') {
	      mem[sr.address] = subroutines[sr.id];
	    } else {
	      throw new Error('Subroutine ' + sr.id + ' was not defined (address ' + sr.address + ')');
	    }
	  }
	  return mem;
	}
      };

      return Assembler;
    }());