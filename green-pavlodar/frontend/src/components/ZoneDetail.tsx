import React from 'react';
import { ZoneAnalysis, ZoneReportResponse } from '../api';
import { PlacedCounts } from '../geo';
import { CATEGORY_META } from '../zones';
import { ZoneData } from '../types';

interface Props {
  zone: ZoneData;
  placed: PlacedCounts;
  analysis: ZoneAnalysis | null;
  report: ZoneReportResponse | null;
  reportBusy: boolean;
  reportError: string;
  editingBounds: boolean;
  onEditText: () => void;
  onToggleBounds: () => void;
  onMakeReport: () => void;
  onDelete: () => void;
  canEdit: boolean;
}

const kzt = (n: number) => Math.round(n).toLocaleString('ru-RU') + ' ₸';
const btn = (bg: string): React.CSSProperties => ({ backgroundColor: bg, color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' });
const box: React.CSSProperties = { backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '12px', lineHeight: '1.6', marginBottom: '10px' };

export const ZoneDetail: React.FC<Props> = ({ zone, placed, analysis, report, reportBusy, reportError, editingBounds, onEditText, onToggleBounds, onMakeReport, onDelete, canEdit }) => {
  const meta = CATEGORY_META[zone.category];
  const d = zone.details;
  const trees = (d.trees || 0) + placed.trees;
  const reportNote = !report ? ''
    : report.source === 'llm' ? `Заключение сформировано ИИ (${report.model}) по посчитанным числам`
    : report.fallback_reason === 'no_key' ? 'Шаблонный текст: ИИ не подключён (на сервере не задан ключ API)'
    : `Шаблонный текст: запрос к ИИ не удался${report.fallback_detail ? ` (${report.fallback_detail})` : ''}`;

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
        <h3 style={{ margin: 0, color: meta.color, fontSize: '16px' }}>{meta.icon} {zone.name}</h3>
        {canEdit && <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onEditText} style={btn('#0284c7')}>✏️ Редактировать данные</button>
          <button onClick={onToggleBounds} style={btn(editingBounds ? '#dc2626' : '#d97706')}>
            {editingBounds ? '❌ Готово' : '📐 Изменить границы на карте'}
          </button>
        </div>}
      </div>

      {d.desc && <p style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>{d.desc}</p>}

      <div style={box}>
        <div><strong>🌳 Деревьев:</strong> {trees} шт. <span style={{ color: '#64748b' }}>(в реестре {d.trees || 0} + расставлено {placed.trees})</span></div>
        {placed.shrubs > 0 && <div><strong>🌺 Кустарников расставлено:</strong> {placed.shrubs} шт.</div>}
        <div><strong>🪑 Скамеек:</strong> {(d.benches || 0) + placed.benches} шт.</div>
        <div><strong>🗑️ Урн:</strong> {(d.bins || 0) + placed.bins} шт.</div>
        {d.attractions && d.attractions.length > 0 && (
          <div><strong>{zone.category === 'forest' ? '🌿 Породы' : '🎡 Достопримечательности'}:</strong> {d.attractions.join(', ')}</div>
        )}
        {d.ph && <div><strong>🧪 Кислотность (pH):</strong> {d.ph}</div>}
        {d.soilType && <div><strong>🌱 Тип почвы:</strong> {d.soilType}</div>}
        {d.salinity !== undefined && <div><strong>🧂 Засоление:</strong> {d.salinity} дСм/м</div>}
      </div>

      {analysis && analysis.is_problem === false && analysis.green_neighbor && (
        <div style={{ ...box, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          ✅ <strong>Зона не считается проблемной:</strong> в радиусе {analysis.green_radius_m} м находится «{analysis.green_neighbor.name}»
          ({analysis.green_neighbor.category === 'forest' ? 'лесной массив' : 'парк'}, около {analysis.green_neighbor.distance_m} м).
          Дефицит посадок и смета для неё не рассчитываются.
        </div>
      )}

      {zone.category !== 'forest' && !analysis && (
        <div style={{ ...box, color: '#64748b' }}>Расчёт недоступен: нет ответа от сервера расчётов.</div>
      )}

      {analysis && analysis.deficit_trees !== null && (
        <div style={{ ...box, backgroundColor: analysis.deficit_trees > 0 ? '#fff5f5' : '#f0fdf4', border: `1px solid ${analysis.deficit_trees > 0 ? '#fed7d7' : '#bbf7d0'}` }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>📊 Расчёт озеленения</div>
          <div>Площадь: {analysis.area_ha} га · плотность: {analysis.density_per_ha} дер./га (цель {analysis.target_density_per_ha})</div>
          <div>
            <strong>{analysis.deficit_trees > 0 ? `⚠️ Не хватает: ${analysis.deficit_trees} деревьев` : '✅ Целевая плотность достигнута'}</strong>
          </div>
          {analysis.planting_plan.length > 0 && (
            <div>🌱 План посадки: {analysis.planting_plan.map((p) => `${p.name_ru} — ${p.count} шт.`).join('; ')}</div>
          )}
          {analysis.recommendations.length > 0 && analysis.deficit_trees > 0 && (
            <div style={{ color: '#475569' }}>
              Подбор видов: {analysis.recommendations.map((r) => `${r.name_ru} (${r.score}) — ${r.reasoning}`).join('; ')}
            </div>
          )}
          {analysis.estimate && (
            <div>💰 Ориентировочная смета: <strong style={{ color: '#dc2626' }}>{kzt(analysis.estimate.summary_kzt)}</strong>
              <div style={{ color: '#64748b' }}>
                Поглощение CO₂ за 5 лет: ≈{analysis.estimate.ecological_effect_5yr.co2_absorption_tons} т
              </div>
            </div>
          )}
          {analysis.assumptions.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: '16px', color: '#64748b', fontSize: '11px' }}>
              {analysis.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
        </div>
      )}

      {analysis && analysis.deficit_trees !== null && (
        <div>
          <button onClick={onMakeReport} disabled={reportBusy} style={{ ...btn('#8b5cf6'), padding: '6px 10px', opacity: reportBusy ? 0.6 : 1 }}>
            {reportBusy ? '⏳ Формирую…' : '🤖 Заключение по зоне (ИИ)'}
          </button>
          {reportError && <div style={{ color: '#b91c1c', fontSize: '11px', marginTop: '6px' }}>{reportError}</div>}
          {report && (
            <div style={{ ...box, marginTop: '8px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
              <div>{report.text}</div>
              <div style={{ color: '#7e22ce', fontSize: '10px', marginTop: '4px' }}>{reportNote}</div>
            </div>
          )}
        </div>
      )}

      {canEdit && (
        <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
          <button onClick={onDelete} style={btn('#b91c1c')}>🗑️ Удалить зону</button>
        </div>
      )}
    </div>
  );
};
