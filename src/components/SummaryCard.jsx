import React, {useState} from 'react'


export default function SummaryCard(){
const [visible, setVisible] = useState(true)


return (
<div className="rounded-lg bg-white p-6 shadow">
<div className="flex justify-between items-start">
<div>
<h2 className="font-semibold text-xl">Resumo do Dia</h2>
<p className="text-sm text-gray-600 mt-1">Total de Venda (0)</p>
</div>
<div className="flex gap-4 items-center">
<button onClick={() => setVisible(!visible)} className="text-sm px-3 py-1 border rounded">{visible? 'Esconder' : 'Mostrar'}</button>
<button className="text-sm px-3 py-1 border rounded">Ações</button>
</div>
</div>


<div className="mt-4 grid grid-cols-2 gap-4">
<div className="p-4 border rounded">
<div className="text-xs text-gray-500">Total de Venda</div>
<div className="text-xl font-bold text-green-600">R$ 0,00</div>
<div className="text-xs text-gray-500 mt-2">Ticket Médio</div>
<div className="text-lg">R$ 0,00</div>
</div>


<div className="p-4 border rounded">
<div className="text-xs text-gray-500">Ordem de Serviço Finalizada (0)</div>
<div className="text-xl font-bold text-green-600">R$ 0,00</div>
<div className="text-xs text-gray-500 mt-2">Ticket Médio</div>
<div className="text-lg">R$ 0,00</div>
</div>
</div>
</div>
)
}