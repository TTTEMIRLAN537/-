import React, { useState } from 'react';
import { ZoneCategory, ZoneDetails } from '../types';

export interface ZoneFormValues extends ZoneDetails {
  name: string;
}

interface Props {
  title: string;
  submitLabel: string;
  submitColor: string;
  category: ZoneCategory;
  initial: ZoneFormValues;
  onSubmit: (values: ZoneFormValues) => void;
  onCancel: () => void;
}

// Подсказки для поля «тип почвы»; можно ввести и свой вариант.
const SOIL_SUGGESTIONS = [
  'Тёмно-каштановая', 'Каштановая', 'Светло-каштановая', 'Чернозём южный',
  'Солонец', 'Солончак', 'Супесчаная', 'Песчаная', 'Пойменная (аллювиальная)',
];

const input: React.CSSProperties = { width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' };
const nonNegInt = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

export const ZoneFormModal: React.FC<Props> = ({ title, submitLabel, submitColor, category, initial, onSubmit, onCancel }) => {
  const [f, setF] = useState<ZoneFormValues>({ ...initial, attractions: initial.attractions || [] });
  const [attractionInput, setAttractionInput] = useState('');
  const [error, setError] = useState('');
  const set = (patch: Partial<ZoneFormValues>) => setF({ ...f, ...patch });
  const attractions = f.attractions || [];
  const listLabel = category === 'forest' ? 'Породы деревьев' : 'Достопримечательности';

  const addAttraction = () => {
    const v = attractionInput.trim();
    if (!v) return;
    if (!attractions.some((a) => a.toLowerCase() === v.toLowerCase())) set({ attractions: [...attractions, v.slice(0, 80)] });
    setAttractionInput('');
  };

  const submit = () => {
    const phText = (f.ph ?? '').toString().trim().replace(',', '.');
    if (phText !== '' && !(Number(phText) >= 0 && Number(phText) <= 14)) {
      setError('Кислотность (pH) должна быть числом от 0 до 14.');
      return;
    }
    const salRaw = (f.salinity as unknown as string | number | undefined);
    const salinity = salRaw === undefined || salRaw === '' ? undefined : Number(salRaw);
    if (salinity !== undefined && !(salinity >= 0)) {
      setError('Засоление должно быть неотрицательным числом.');
      return;
    }
    // дописываем недобавленную достопримечательность, если пользователь не нажал «+»
    const pending = attractionInput.trim();
    const finalList = pending && !attractions.includes(pending) ? [...attractions, pending] : attractions;
    onSubmit({
      ...f,
      name: f.name.trim() || 'Новая зона',
      trees: nonNegInt(f.trees),
      benches: nonNegInt(f.benches),
      bins: nonNegInt(f.bins),
      ph: phText === '' ? undefined : phText,
      soilType: f.soilType?.trim() || undefined,
      salinity,
      attractions: finalList,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '460px', maxHeight: '90vh', overflowY: 'auto', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <h3 style={{ marginTop: 0, color: '#0f172a' }}>{title}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
          <label><strong>Название:</strong></label>
          <input type="text" value={f.name} onChange={(e) => set({ name: e.target.value })} style={input} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div><label><strong>Деревьев:</strong></label><input type="number" min={0} value={f.trees} onChange={(e) => set({ trees: e.target.value as unknown as number })} style={input} /></div>
            <div><label><strong>Скамеек:</strong></label><input type="number" min={0} value={f.benches} onChange={(e) => set({ benches: e.target.value as unknown as number })} style={input} /></div>
            <div><label><strong>Урн:</strong></label><input type="number" min={0} value={f.bins} onChange={(e) => set({ bins: e.target.value as unknown as number })} style={input} /></div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}><strong>🌱 Почва</strong></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label><strong>Кислотность, pH (0–14):</strong></label>
              <input type="number" min={0} max={14} step="0.1" placeholder="например, 7.2" value={f.ph ?? ''} onChange={(e) => set({ ph: e.target.value })} style={input} />
            </div>
            <div>
              <label><strong>Тип почвы:</strong></label>
              <input type="text" list="soil-types" placeholder="выберите или введите" value={f.soilType ?? ''} onChange={(e) => set({ soilType: e.target.value })} style={input} />
              <datalist id="soil-types">{SOIL_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
          </div>
          <div>
            <label><strong>Засоление, дСм/м (необязательно):</strong></label>
            <input type="number" min={0} step="0.1" value={f.salinity ?? ''} onChange={(e) => set({ salinity: e.target.value as unknown as number })} style={input} />
          </div>

          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="checkbox" checked={!!f.isIndustrial} onChange={(e) => set({ isIndustrial: e.target.checked })} /> Промышленная зона (нужна газоустойчивость)
          </label>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="checkbox" checked={!!f.nearSensitive} onChange={(e) => set({ nearSensitive: e.target.checked })} /> Рядом школа или больница (без аллергенных видов)
          </label>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}><strong>{category === 'forest' ? '🌿' : '🎡'} {listLabel}</strong> <span style={{ color: '#64748b' }}>(необязательно)</span></div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              maxLength={80}
              placeholder={category === 'forest' ? 'Например: Сосна обыкновенная' : 'Например: Фонтан, колесо обозрения'}
              value={attractionInput}
              onChange={(e) => setAttractionInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAttraction(); } }}
              style={input}
            />
            <button onClick={addAttraction} style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '0 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>＋</button>
          </div>
          {attractions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {attractions.map((a) => (
                <span key={a} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '2px 4px 2px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {a}
                  <button title="Убрать" onClick={() => set({ attractions: attractions.filter((x) => x !== a) })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', fontWeight: 'bold' }}>✕</button>
                </span>
              ))}
            </div>
          )}

          <label><strong>Описание:</strong></label>
          <textarea value={f.desc ?? ''} onChange={(e) => set({ desc: e.target.value })} style={{ ...input, height: '60px' }} />
        </div>

        {error && <div style={{ color: '#b91c1c', fontSize: '12px', marginTop: '10px' }}>⚠️ {error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button onClick={onCancel} style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Отмена</button>
          <button onClick={submit} style={{ backgroundColor: submitColor, color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
};
