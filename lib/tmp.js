const fetch = require('node-fetch');

let settings = { method: "Get" };

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fu(url){
    let res = '';
    await fetch(url,settings).then(res=>res.json()).then((json)=>{ json.forEach(i => res += i.body + ' ' ); });
    res = res.split('@').reverse();
    res.pop();
    console.log(res);
    let toAssign = [];
    res.forEach(i=>toAssign.push(i.split(' ')[0]));
    console.log(toAssign.sort());
    prev = ''
    toAssign.sort().forEach(i=>{
        if(i!=prev){
            console.log(i);
            prev=i;
        }
    })
}

let url = 'https://api.github.com/repos/amey-kudari/oppia/issues/1/comments'

fu(url);
//let res = fu(url);
//console.log(res)
//fetch(url,settings).then(res=>res.json()).then((json)=>{ json.forEach(i=>console.log('printing data ' + i.body + ' end'))});
