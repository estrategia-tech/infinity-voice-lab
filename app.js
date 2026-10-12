'use strict';
const $=id=>document.getElementById(id);
const questions=[
'Hola, soy la asistente virtual de Infinity Living. Esta es una demostración con información ficticia. ¿Buscas un departamento para vivir o para invertir?',
'Gracias. ¿Qué presupuesto aproximado tienes considerado?',
'¿En qué zona te gustaría encontrarlo?',
'¿En qué plazo te gustaría tomar una decisión?',
'¿Consideras un crédito hipotecario o recursos propios?',
'¿Cómo prefieres que un asesor humano se comunique contigo, si decides autorizarlo?',
'Gracias por compartirlo. Esta fue una simulación: no se guardaron datos ni se programó contacto.'
];
let active=false,stage=0,remaining=180,interval=null;
function message(who,text){const p=document.createElement('p');const b=document.createElement('strong');b.textContent=who+': ';p.append(b,document.createTextNode(text));$('chat').append(p);$('chat').scrollTop=$('chat').scrollHeight;}
function finish(label='Sesión finalizada'){active=false;if(interval)clearInterval(interval);interval=null;$('start').disabled=false;$('stop').disabled=true;$('answer').disabled=true;$('send').disabled=true;$('status').textContent=label;}
function start(){finish();stage=0;remaining=180;$('clock').textContent='03:00';$('chat').replaceChildren();active=true;$('start').disabled=true;$('stop').disabled=false;$('answer').disabled=false;$('send').disabled=false;$('status').textContent='Simulación en curso';message('Asistente',questions[0]);$('answer').focus();interval=setInterval(()=>{remaining=Math.max(0,remaining-1);$('clock').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;if(remaining===0){message('Sistema','Se alcanzó el límite de tres minutos.');finish('Tiempo agotado');}},1000);}
function reply(){if(!active)return;const v=$('answer').value.trim();if(!v)return;$('answer').value='';message('Tú',v);if(/no me (llames|contactes)|no llamar|no contactar|no quiero (que me|recibir)|borrar mis datos/i.test(v)){message('Asistente','Entendido. En una llamada real respetaríamos tu solicitud de no contacto. Aquí no se registró información.');finish('Preferencia respetada');return;}if(/ocupad[oa]|ll[aá]mame (luego|despu[eé]s)|otro momento/i.test(v)){message('Asistente','Claro. En una llamada real confirmaríamos primero el horario y tu autorización para volver a llamar. Aquí no se agenda nada.');finish('Simulación de devolución');return;}stage++;message('Asistente',questions[Math.min(stage,questions.length-1)]);if(stage>=questions.length-1)finish('Simulación completada');}
$('start').addEventListener('click',start);$('stop').addEventListener('click',()=>finish('Finalizada por el usuario'));$('send').addEventListener('click',reply);$('answer').addEventListener('keydown',e=>{if(e.key==='Enter')reply()});
