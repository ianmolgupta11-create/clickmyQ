const {PrismaClient}=require("@prisma/client");
const fs=require("fs");
const p=new PrismaClient();
(async()=>{
  const tables=await p.$queryRaw`SHOW TABLES`;
  const out={};
  for(const t of tables){
    const name=Object.values(t)[0];
    out[name]=await p.$queryRawUnsafe(`SELECT * FROM \`${name}\``);
  }
  const path=`tmp/backup-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
  fs.writeFileSync(path, JSON.stringify(out,(k,v)=>typeof v==="bigint"?v.toString():v,null,2));
  console.log("Backup written:",path);
  console.log("Tables:",Object.keys(out).length);
  for(const k of Object.keys(out)) console.log(" ",k,out[k].length);
  await p.$disconnect();
})();
