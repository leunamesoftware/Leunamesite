import { Heart, Radio, Star, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CourseCard as Card } from '../../../shared/contracts';
import { useI18n } from '../i18n';
import { Avatar } from './avatar';
import { dayShort, money, time } from './format';

/**
 * Course card (Explore / Home / Favorites). Owner rule: it reacts to taps only when there is
 * a class the visitor can still buy. Otherwise it shows why (live, no seats) and nothing is clickable.
 */
export function CourseCard({ card, onFavorite }: { card: Card; onFavorite?: (on: boolean) => void }) {
  const { t, lang, fill } = useI18n();
  const navigate = useNavigate();
  const next = card.nextClass;
  const clickable = !!next;
  const open = () => clickable && navigate(`/course/${card.id}`);
  const photo = card.coverUrl ?? card.instructor.avatarUrl;
  const rating = card.rating ?? card.instructor.rating;

  return (
    <article
      className={`ccard${clickable ? ' ccard-on' : ' ccard-off'}`}
      onClick={open}
      onKeyDown={(e) => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } }}
      tabIndex={clickable ? 0 : -1}
      role={clickable ? 'link' : undefined}
      aria-disabled={!clickable}
    >
      {photo ? <img className="ccard-img" src={photo} alt="" loading="lazy" /> : <div className="ccard-img ccard-img-empty" aria-hidden />}
      <div className="ccard-top">
        {card.liveNow
          ? <span className="pill pill-live"><Radio size={15} aria-hidden />{t.card.live}</span>
          : next ? <span className="pill pill-light">{fill(t.card.startsOn, { date: `${dayShort(next.startsAt, lang)} · ${time(next.startsAt, lang)}` })}</span>
          : <span className="pill pill-dark">{t.card.noNextClass}</span>}
        {next && <span className="pill pill-dark"><UsersRound size={15} aria-hidden />{fill(t.card.seatsLeft, { n: String(next.seatsLeft) })}</span>}
      </div>
      <div className="ccard-bottom">
        <h3>{card.title}</h3>
        <div className="ccard-meta">
          <Avatar url={card.instructor.avatarUrl} name={card.instructor.name} size={30} />
          <span className="ccard-teacher">{card.instructor.name}</span>
          {rating != null
            ? <span className="ccard-rating"><Star size={15} fill="currentColor" aria-hidden />{rating.toLocaleString(lang, { minimumFractionDigits: 1 })}</span>
            : <span className="ccard-new">{t.card.newTeacher}</span>}
        </div>
        {next && (
          <div className="ccard-action">
            <span className="ccard-price">{next.priceCents === 0 ? t.card.free : money(next.priceCents, next.currency, lang)}<small> {t.card.perGroup}</small></span>
            <span className="ccard-btn">{t.card.book}</span>
          </div>
        )}
      </div>
      {onFavorite && clickable && (
        <button type="button" className={`ccard-fav${card.favorite ? ' ccard-fav-on' : ''}`}
          aria-label={card.favorite ? t.course.unfavorite : t.course.favorite} aria-pressed={card.favorite}
          onClick={(e) => { e.stopPropagation(); onFavorite(!card.favorite); }}>
          <Heart size={20} fill={card.favorite ? 'currentColor' : 'none'} aria-hidden />
        </button>
      )}
    </article>
  );
}
