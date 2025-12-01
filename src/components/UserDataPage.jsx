import React, { useEffect, useMemo, useState } from 'react'
import { updateUser, updateSubUser, changeOwnerPassword, changeMemberPassword } from '../services/users'

export default function UserDataPage({ user, onBack }){
  const isMember = !!user?.memberId
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '')
  const [notifyEmail, setNotifyEmail] = useState(!!(user?.notifyEmail))

  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')

  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)

  useEffect(() => {
    setName(user?.name || '')
    setEmail(user?.email || '')
    setWhatsapp(user?.whatsapp || '')
    setNotifyEmail(!!user?.notifyEmail)
  }, [user])

  async function handleSaveProfile(e){
    e?.preventDefault?.()
    setSaving(true)
    setSaveErr('')
    setSaveMsg('')
    try {
      const payload = { name: name.trim(), whatsapp: whatsapp.trim(), notifyEmail }
      if (isMember) await updateSubUser(user.ownerId, user.memberId, payload)
      else await updateUser(user.id, payload)
      setSaveMsg('Dados atualizados com sucesso.')
    } catch (err) {
      setSaveErr(err?.message || 'Falha ao salvar dados')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e){
    e?.preventDefault?.()
    setPwdSaving(true)
    setPwdErr('')
    setPwdMsg('')
    const cur = curPwd
    const np = newPwd
    const cp = confirmPwd
    if (!cur || !np || !cp) { setPwdErr('Preencha todos os campos de senha.'); setPwdSaving(false); return }
    if (np.length < 6) { setPwdErr('Nova senha deve ter ao menos 6 caracteres.'); setPwdSaving(false); return }
    if (np !== cp) { setPwdErr('Confirmação não corresponde à nova senha.'); setPwdSaving(false); return }
    try {
      if (isMember) await changeMemberPassword(user.ownerId, user.memberId, cur, np)
      else await changeOwnerPassword(user.id, cur, np)
      setPwdMsg('Senha alterada com sucesso.')
      setCurPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err) {
      setPwdErr(err?.message || 'Falha ao alterar senha')
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dados do usuário</h2>
        <button
          type="button"
          onClick={() => onBack && onBack()}
          className="text-sm text-gray-600 hover:text-gray-800"
        >Voltar</button>
      </div>

      {/* Nome completo */}
      <div className="rounded-lg bg-white dark:bg-[#101a2d] p-4 shadow">
        <label className="text-sm text-gray-700 dark:text-gray-200">Seu nome</label>
        <input
          type="text"
          className="mt-2 w-full border rounded p-2 bg-gray-50 dark:bg-[#0b1320] dark:text-white dark:border-gray-700"
          value={name}
          onChange={e=>setName(e.target.value)}
          placeholder="Seu nome"
        />
      </div>

      {/* Dados de contato */}
      <div className="rounded-lg bg-white dark:bg-[#101a2d] p-4 shadow">
        <div className="font-medium text-sm mb-3 text-gray-800 dark:text-gray-100">Dados de contato</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-700 dark:text-gray-200">E-mail</label>
            <input
              type="email"
              className="mt-2 w-full border rounded p-2 bg-gray-100 dark:bg-[#0b1320] dark:text-white dark:border-gray-700"
              value={email}
              readOnly
            />
          </div>
          <div>
            <label className="text-sm text-gray-700 dark:text-gray-200">Telefone</label>
            <input
              type="tel"
              className="mt-2 w-full border rounded p-2 bg-gray-50 dark:bg-[#0b1320] dark:text-white dark:border-gray-700"
              value={whatsapp}
              onChange={e=>setWhatsapp(e.target.value)}
              placeholder="(00) 0 0000-0000"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNotifyEmail(v=>!v)}
            className={`w-11 h-6 rounded-full relative ${notifyEmail ? 'bg-green-600' : 'bg-gray-300'}`}
            aria-pressed={notifyEmail}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${notifyEmail ? 'right-0.5' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-200">Receber notificações por E-mail</span>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => { setName(user?.name||''); setWhatsapp(user?.whatsapp||''); setNotifyEmail(!!user?.notifyEmail); setSaveErr(''); setSaveMsg('') }}
            className="text-sm text-gray-600 hover:text-gray-800"
          >Cancelar</button>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={saving}
            className="px-3 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-60"
          >{saving ? 'Salvando...' : 'Salvar alterações'}</button>
        </div>
        {saveErr && <div className="mt-2 text-sm text-red-600">{saveErr}</div>}
        {saveMsg && <div className="mt-2 text-sm text-green-600">{saveMsg}</div>}
      </div>

      {/* Senha */}
      <div className="rounded-lg bg-white dark:bg-[#101a2d] p-4 shadow">
        <div className="font-medium text-sm mb-3 text-gray-800 dark:text-gray-100">Senha</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-gray-700 dark:text-gray-200">Senha atual</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type={showCur ? 'text' : 'password'}
                className="flex-1 border rounded p-2 bg-gray-50 dark:bg-[#0b1320] dark:text-white dark:border-gray-700"
                value={curPwd}
                onChange={e=>setCurPwd(e.target.value)}
                placeholder="••••••"
              />
              <button type="button" onClick={()=>setShowCur(s=>!s)} className="text-sm text-gray-600 dark:text-gray-300">
                {showCur ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-700 dark:text-gray-200">Nova senha</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type={showNew ? 'text' : 'password'}
                className="flex-1 border rounded p-2 bg-gray-50 dark:bg-[#0b1320] dark:text-white dark:border-gray-700"
                value={newPwd}
                onChange={e=>setNewPwd(e.target.value)}
                placeholder="••••••"
              />
              <button type="button" onClick={()=>setShowNew(s=>!s)} className="text-sm text-gray-600 dark:text-gray-300">
                {showNew ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-700 dark:text-gray-200">Confirmar nova senha</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type={showConfirm ? 'text' : 'password'}
                className="flex-1 border rounded p-2 bg-gray-50 dark:bg-[#0b1320] dark:text-white dark:border-gray-700"
                value={confirmPwd}
                onChange={e=>setConfirmPwd(e.target.value)}
                placeholder="••••••"
              />
              <button type="button" onClick={()=>setShowConfirm(s=>!s)} className="text-sm text-gray-600 dark:text-gray-300">
                {showConfirm ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => { setCurPwd(''); setNewPwd(''); setConfirmPwd(''); setPwdErr(''); setPwdMsg('') }}
            className="text-sm text-gray-600 hover:text-gray-800"
          >Cancelar</button>
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={pwdSaving}
            className="px-3 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-60"
          >{pwdSaving ? 'Salvando...' : 'Salvar alterações'}</button>
        </div>
        {pwdErr && <div className="mt-2 text-sm text-red-600">{pwdErr}</div>}
        {pwdMsg && <div className="mt-2 text-sm text-green-600">{pwdMsg}</div>}
      </div>
    </div>
  )
}

