import React from 'react'


export default function IntegrationsCard(){
return (
<div className="rounded-lg bg-[#0f1724] text-white p-6 shadow">
<h3 className="font-semibold text-lg">Conecte suas ferramentas</h3>
<p className="mt-3 text-sm text-gray-200">Nenhuma integração ativa no momento. Conecte suas ferramentas favoritas e potencialize sua produtividade.</p>
<div className="mt-4">
<button className="bg-green-600 px-3 py-2 rounded">Explorar Integrações</button>
</div>
</div>
)
}