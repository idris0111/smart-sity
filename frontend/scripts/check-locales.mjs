import fs from 'node:fs'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
const copy=JSON.parse(fs.readFileSync('src/locales.json','utf8'))
for(const [key,translations] of Object.entries(copy)) {
 const markers=(key.match(/\{\d+\}/g)||[]).sort()
 for(const language of ['ru','en','tg']) {
  assert.ok(translations[language], `${language}: missing ${key}`)
  assert.deepEqual((translations[language].match(/\{\d+\}/g)||[]).sort(),markers,`${language}: interpolation ${key}`)
 }
}
const server=await createServer({ optimizeDeps:{noDiscovery:true,include:[]}, server:{middlewareMode:true},appType:'custom',plugins:[{name:'locale-check-map',enforce:'pre',resolveId(source){if(source.endsWith('/CityMap.jsx'))return '\0map-check'},load(id){if(id==='\0map-check')return 'export default function CityMap(){return null}'} }]})
try {
 const i18n=await server.ssrLoadModule('/src/i18n.js')
 const {commandTranslations}=await server.ssrLoadModule('/src/command-i18n.ts')
 for(const [key,values] of Object.entries(commandTranslations)) {
  assert.equal(values.length,3,key)
  for(const value of values) assert.ok(typeof value==='string'&&value.length>0,key)
 }
 console.log(`OK ${Object.keys(commandTranslations).length} command-center labels: ru/en/tg`)
 const pages=await server.ssrLoadModule('/src/Pages.jsx')
 const {default:Auth}=await server.ssrLoadModule('/src/AuthPage.jsx')
 const {default:Center}=await server.ssrLoadModule('/src/components/CommandCenter.tsx')
 const {default:Cameras}=await server.ssrLoadModule('/src/components/CameraManagement.tsx')
 const {default:RoadRoutes}=await server.ssrLoadModule('/src/components/RoadRoutes.tsx')
 const {default:Admin}=await server.ssrLoadModule('/src/components/CityAdmin.tsx')
 const {default:Assistant}=await server.ssrLoadModule('/src/components/CityAssistant.tsx')
 const props={data:{parkings:[],spots:[],bookings:[],stops:[],routes:[],vehicles:[],incidents:[],requests:[]},routePath:{coordinates:[]},filters:{},stats:{},profile:{username:'admin'},navigate(){},setFilters(){},setSelected(){},setProfile(){},notify(){},reload(){}}
 for(const language of ['ru','en','tg']) {
  i18n.setLanguage(language)
  const html=renderToStaticMarkup(React.createElement(Auth,{onDone(){}}))
  assert.ok(html.includes(i18n.tr('Welcome back')))
  assert.ok(html.includes('name="username"'))
  assert.ok(html.includes('value="tg"'))
  for (const accent of ['blue','red','green']) assert.ok(html.includes(`value="${accent}"`), `login accent option: ${accent}`)
  for(const name of ['DashboardPage','MapPage','ParkingPage','RoutesPage','IncidentsPage','RequestsPage','CameraPage','AssistantPage','ProfilePage']) assert.ok(renderToStaticMarkup(React.createElement(pages[name],{...props,language})).length>100,name)
  const centerProps={...props,language,data:{...props.data,cameras:[],alerts:[]},routePath:null,profile:{username:'admin',is_staff:true},system:{database:'online',redis:'disabled',worker:'offline',ai:false,layers:[]},liveEvents:[],realtimeStatus:'disconnected',onMapAction:async()=>{}}
  for(const Component of [Center,Cameras,RoadRoutes,Admin,Assistant]) {
   const markup=renderToStaticMarkup(React.createElement(Component,centerProps))
   assert.ok(markup.length>100)
   assert.ok(!markup.includes('undefined'))
  }
  assert.ok(renderToStaticMarkup(React.createElement(Center,centerProps)).includes('WS DISCONNECTED'))
  assert.equal(i18n.getLocale(), {ru:'ru-RU',en:'en-US',tg:'tg-TJ'}[language])
  console.log(`OK ${language}: login and all 9 pages render`)
 }
 i18n.setLanguage('invalid')
 assert.equal(i18n.getLocale(),'tg-TJ')
 console.log(`OK ${Object.keys(copy).length} translations: all languages and interpolations complete`)
} finally {await server.close()}
