import React, {useState} from 'react'


export default function NotificationsCard(){
const [unread, setUnread] = useState(1)
return (
<div className="rounded-lg bg-white p-4 shadow">
<div className="flex items-center justify-between">
<h4 className="font-semibold">Notificações</h4>
<button className="text-sm text-green-600">Ver Todas →</button>
</div>


<div className="mt-3 text-sm text-gray-600">{unread} notificação não lida <button onClick={() => setUnread(0)} className="ml-3 text-xs text-gray-400">Marcar Todas Como Lidas</button></div>


<div className="mt-3 border-t pt-3">
<div className="flex gap-3">
<div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center">i</div>
<div>
<div className="font-medium">Novo número de suporte</div>
<div className="text-xs text-gray-500">Equipe Apex Comércio - 2 meses atrás</div>
<div className="mt-2 text-sm text-gray-700">O número antigo foi cancelado, e agora todo o atendimento passa a ser feito exclusivamente pelo nosso novo número oficial: (33) 99938-5207</div>
</div>
<div className="ml-auto flex items-center"><div className="green-dot"></div></div>
</div>
</div>
</div>
)
}