package ru.dvizh.persistence;

import java.util.*;
import jakarta.persistence.*;
import org.springframework.stereotype.Repository;
import ru.dvizh.api.Problem;
import ru.dvizh.domain.BaseEntity;

/** Parameterized JPQL. All query fragments are constants owned by services. */
@Repository
public class Store {
    @PersistenceContext private EntityManager em;

    public <T> T get(Class<T> type, UUID id) {
        T entity = em.find(type, id);
        if (entity == null) throw Problem.notFound();
        return entity;
    }
    public <T> T lock(Class<T> type, UUID id) {
        T entity = em.find(type, id, LockModeType.PESSIMISTIC_WRITE);
        if (entity == null) throw Problem.notFound();
        return entity;
    }
    public <T extends BaseEntity> T add(T entity) { em.persist(entity); return entity; }
    /** A candidate query may have cached an older version before another transaction acquired the lock. */
    public <T> T refreshLocked(T entity) { em.flush();em.refresh(entity,LockModeType.PESSIMISTIC_WRITE);return entity; }
    public void flush() { em.flush(); }
    public int execute(String jpql,Map<String,?> params) {
        em.flush();var query=em.createQuery(jpql);params.forEach(query::setParameter);
        int changed=query.executeUpdate();em.clear();return changed;
    }
    public <T> List<T> list(Class<T> type, String condition, Map<String,?> params, String order, int offset, int limit) {
        var q = em.createQuery("select e from " + type.getSimpleName() + " e" + where(condition) + " order by " + order, type);
        params.forEach(q::setParameter);
        return q.setFirstResult(offset).setMaxResults(limit).getResultList();
    }
    public <T> List<T> list(Class<T> type, String condition, Map<String,?> params) {
        return list(type,condition,params,"e.createdAt asc, e.id asc",0,Integer.MAX_VALUE);
    }
    public <T> Optional<T> first(Class<T> type, String condition, Map<String,?> params) {
        return list(type,condition,params,"e.createdAt asc, e.id asc",0,1).stream().findFirst();
    }
    public long count(Class<?> type, String condition, Map<String,?> params) {
        var q = em.createQuery("select count(e) from " + type.getSimpleName() + " e" + where(condition), Long.class);
        params.forEach(q::setParameter);
        return q.getSingleResult();
    }
    public long sum(Class<?> type, String property, String condition, Map<String,?> params) {
        var q = em.createQuery("select coalesce(sum(e."+property+"),0) from " + type.getSimpleName() + " e" + where(condition), Long.class);
        params.forEach(q::setParameter);
        return q.getSingleResult();
    }
    private String where(String condition) { return condition == null || condition.isBlank() ? "" : " where " + condition; }
}
