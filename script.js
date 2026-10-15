const GEMINI_MODEL="gemini-2.5-flash"; // غيّر اسم النموذج هنا إن أردت
const $=id=>document.getElementById(id);
let files=[];
try{pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"}catch(e){}

/* ---------- upload ---------- */
function addFiles(l){for(const f of l)files.push(f);draw()}
function draw(){
  $("thumbs").innerHTML="";
  files.forEach((f,i)=>{const d=document.createElement("div");d.className="th";
    const s=document.createElement("span");s.textContent=f.name;const b=document.createElement("button");b.textContent="×";b.onclick=()=>{files.splice(i,1);draw()};
    d.append(s,b);$("thumbs").append(d)});
  $("ext").disabled=!files.length;
}
$("drop").onclick=()=>$("file").click();
$("file").onchange=e=>{addFiles(e.target.files);e.target.value=""};
$("drop").ondragover=e=>{e.preventDefault();$("drop").classList.add("on")};
$("drop").ondragleave=()=>$("drop").classList.remove("on");
$("drop").ondrop=e=>{e.preventDefault();$("drop").classList.remove("on");addFiles(e.dataTransfer.files)};

async function toImages(f){
  if(f.type==="application/pdf"||/\.pdf$/i.test(f.name)){
    const pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;
    const out=[];
    for(let p=1;p<=Math.min(pdf.numPages,2);p++){
      const pg=await pdf.getPage(p),vp=pg.getViewport({scale:1.6});
      const c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;
      await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
      out.push(await new Promise(r=>c.toBlob(r,"image/jpeg",.85)));
    }
    return out;
  }
  return [await shrink(f)];
}
async function shrink(f){
  const bmp=await createImageBitmap(f),k=Math.min(1,1600/Math.max(bmp.width,bmp.height));
  const c=document.createElement("canvas");c.width=bmp.width*k;c.height=bmp.height*k;
  c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
  return new Promise(r=>c.toBlob(r,"image/jpeg",.88));
}

/* ---------- extraction (Claude) ---------- */
$("ext").onclick=async()=>{
  const st=$("st");st.className="";st.textContent="جارٍ قراءة الملفات…";$("ext").disabled=true;
  try{
    const key=(typeof GEMINI_API_KEY!=="undefined"?GEMINI_API_KEY:"").trim();if(!key||key==="PUT_YOUR_KEY_HERE")throw new Error("لم يُضبط المفتاح في ملف config.js");
    let imgs=[];for(const f of files)imgs.push(...await toImages(f));
    imgs=imgs.slice(0,8);
    const prompt=`الصور المرفقة هي وثائق (هوية شخصية و/أو شهادة سجل تجاري) تخص الطرف الثاني في عقد. استخرج البيانات فقط كما هي مكتوبة، ولا تخمّن. أعد JSON فقط بهذه المفاتيح (نص فارغ إذا لم توجد):
{"companyAr":"اسم الشركة/المنشأة بالعربية","companyEn":"company name in English","crNo":"رقم السجل التجاري كما هو (مثل 197428 - 1)","addressAr":"العنوان التجاري بالعربية: شقة/محل، مبنى، طريق، مجمع، المنطقة","addressEn":"commercial address in English: Flat/Shop, Building, Road, Block, Area","personAr":"اسم صاحب الهوية بالعربية","personEn":"name of ID holder in English"}`;
    const b64=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(",")[1]);f.readAsDataURL(b)});
    const imgs64=[];for(const b of imgs)imgs64.push(await b64(b));
    const resp=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+GEMINI_MODEL+":generateContent",{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents:[{parts:[...imgs64.map(d=>({inline_data:{mime_type:"image/jpeg",data:d}})),{text:prompt}]}],generationConfig:{temperature:0,responseMimeType:"application/json"}})});
    const data=await resp.json();if(!resp.ok)throw new Error(data.error&&data.error.message||resp.status);
    const txt=(data.candidates&&data.candidates[0]&&data.candidates[0].content.parts.map(p=>p.text||"").join("")||"").replace(/```json|```/g,"").trim();
    const r=JSON.parse(txt.slice(txt.indexOf("{"),txt.lastIndexOf("}")+1));
    const nm=(a,b)=>a||b||"";
    $("nameAr").value=nm(r.companyAr,r.personAr);$("nameEn").value=nm(r.companyEn,r.personEn);
    $("addrAr").value=r.addressAr||"";$("addrEn").value=r.addressEn||"";
    $("cr").value=r.crNo||"";$("sigAr").value=r.personAr||"";$("sigEn").value=r.personEn||"";
    st.textContent="تم الاستخراج. راجع البيانات أدناه ثم نزّل العقد.";
  }catch(e){st.className="err";st.textContent="تعذّر الاستخراج: "+(e.message||e.code||e)+" — يمكنك إدخال البيانات يدوياً."}
  $("ext").disabled=!files.length;
};

/* ---------- number to words ---------- */
const EO=["","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"],ET=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
const AO=["","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة","عشرة","أحد عشر","اثنا عشر","ثلاثة عشر","أربعة عشر","خمسة عشر","ستة عشر","سبعة عشر","ثمانية عشر","تسعة عشر"],AT=["","","عشرون","ثلاثون","أربعون","خمسون","ستون","سبعون","ثمانون","تسعون"];
function words(n){
  if(!Number.isInteger(n)||n<1||n>100)return null;
  if(n===100)return{en:"one hundred",ar:"مائة"};
  if(n<20)return{en:EO[n],ar:AO[n]};
  const t=Math.floor(n/10),u=n%10;
  return{en:ET[t]+(u?"-"+EO[u]:""),ar:(u?AO[u]+" و":"")+AT[t]};
}

/* ---------- PDF overlay ---------- */
const H=841.89;
function textPng(txt,w,h,rtl,align,maxW){
  const S=5,c=document.createElement("canvas");c.width=Math.ceil(maxW*S);c.height=Math.ceil(h*S);
  const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);
  let fs=h*S*.85;x.direction=rtl?"rtl":"ltr";
  const f=s=>`${s}px Tahoma, Arial, sans-serif`;
  x.font=f(fs);while(x.measureText(txt).width>c.width-4&&fs>8){fs-=2;x.font=f(fs)}
  x.fillStyle="#000";x.textBaseline="middle";
  const tw=x.measureText(txt).width;
  x.textAlign="left";
  let px=align==="r"?c.width-tw-2:align==="c"?(c.width-tw)/2:2;
  x.fillText(txt,px,c.height/2+fs*.04);
  return c;
}
/* each item: page, text, cover box [x0,yTop,x1,yBottom] (pt, top-origin), text area, rtl, align */
function items(v){
  const w=words(parseFloat(v.com)),n=v.com;
  const L=[];
  const T=(pg,t,cov,area,rtl,al)=>{if(t)L.push({pg,t,cov,area,rtl,al})};
  // page 1: English
  T(0,v.nameEn,[124.9,238.8,194.5,246.7],[125,237.8,315,247.7],0,"l");
  T(0,v.addrEn,[75,248.9,257.4,256.7],[75,247.9,330,257.7],0,"l");
  T(0,v.cr,[102.1,258.5,137.1,266.3],[102,257.5,200,267.3],0,"l");
  // page 1: Arabic
  T(0,v.nameAr,[349.9,246.5,471.1,254.3],[340,245.5,471.1,255.3],1,"r");
  T(0,v.addrAr,[337.5,262,537.8,269.8],[335,261,537.8,270.8],1,"r");
  T(0,v.cr,[471.1,274.1,503.7,281.9],[400,273.1,503.7,283],1,"r");
  // commission
  if(n){
    if(w)T(0,w.en,[122.7,571.3,130.7,579.2],[118,570.3,135,580.2],0,"c");
    T(0,n,[156.5,570.4,161.8,579.5],[155,569.4,163,580.5],0,"c");
    T(0,n,[339.8,642.2,347.5,650.1],[338,641.2,349,651.1],1,"c");
    if(w)T(0,w.ar,[322.1,641.8,329.6,650.1],[316,640.8,331,651.1],1,"c");
  }
  // page 2: signature (English)
  T(1,v.sigEn,[148,766,300,775.1],[148,765,300,776.1],0,"l");
  // page 3: addendum second party
  T(2,v.nameEn,[100,562.2,330,573.9],[100,561.2,330,575],0,"l");
  T(2,v.nameAr,[352.4,562.2,472.3,573.9],[345,561.2,472.3,575],1,"r");
  return L;
}
async function build(v){
  const {PDFDocument}=PDFLib;
  const bytes=Uint8Array.from(atob(BASE64_PDF),c=>c.charCodeAt(0));
  const doc=await PDFDocument.load(bytes),pages=doc.getPages();
  for(const it of items(v)){
    const [ax0,ay0,ax1,ay1]=it.area,aw=ax1-ax0,ah=ay1-ay0;
    const cv=textPng(it.t,aw,ah,it.rtl,it.al,aw);
    const png=await new Promise(r=>cv.toBlob(r,"image/png"));
    const img=await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
    pages[it.pg].drawImage(img,{x:ax0,y:H-ay1,width:aw,height:ah});
  }
  return await doc.save();
}
$("dl").onclick=async()=>{
  const s=$("st2");s.className="";s.textContent="جارٍ إنشاء الملف…";
  try{
    const v={nameAr:$("nameAr").value.trim(),nameEn:$("nameEn").value.trim(),addrAr:$("addrAr").value.trim(),addrEn:$("addrEn").value.trim(),cr:$("cr").value.trim(),com:$("com").value.trim(),sigAr:$("sigAr").value.trim(),sigEn:$("sigEn").value.trim()};
    const out=await build(v);
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([out],{type:"application/pdf"}));a.download="contract-filled.pdf";document.body.append(a);a.click();a.remove();s.textContent="تم."
  }catch(e){s.className="err";s.textContent="تعذّر إنشاء الملف: "+(e.message||e.code||e)}
};
