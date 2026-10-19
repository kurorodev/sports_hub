package ru.dvizh.service;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.dvizh.api.*;
import ru.dvizh.domain.*;
import ru.dvizh.persistence.Store;

@Service @Transactional(readOnly=true)
public class SessionService {
    private final Store db;private final Views view;private final boolean demo;
    public SessionService(Store db,Views view,@Value("${app.demo-enabled}") boolean demo){this.db=db;this.view=view;this.demo=demo;}
    private void requireDemo(){if(!demo)throw Problem.notFound();}
    public List<Api.DemoAccount> accounts() {
        requireDemo();return db.list(UserEntity.class,"e.demoAccount is not null",Map.of(),"e.demoAccount asc",0,100).stream()
            .map(u -> new Api.DemoAccount(u.demoAccount,u.displayName,roles(u),u.sportsRoles.stream().sorted().toList())).toList();
    }
    public UUID login(String account) {
        requireDemo();return db.first(UserEntity.class,"e.demoAccount=:account",Map.of("account",account)).orElseThrow(Problem::notFound).id;
    }
    public Api.Session session(UUID user,String token) {
        var u=db.get(UserEntity.class,user);
        var organizations=db.list(OrganizationEntity.class,"e.createdBy=:user and e.status=:status",Map.of("user",user,"status",Api.OrganizationStatus.APPROVED));
        return new Api.Session(view.profile(u),roles(u),organizations.stream().map(o -> o.id).toList(),token,demo);
    }
    private List<Api.SystemRole> roles(UserEntity u) {
        var roles=new ArrayList<Api.SystemRole>();roles.add(Api.SystemRole.USER);
        if(u.admin)roles.add(Api.SystemRole.ADMIN);
        if(db.count(OrganizationEntity.class,"e.createdBy=:user and e.status=:status",Map.of("user",u.id,"status",Api.OrganizationStatus.APPROVED))>0)roles.add(Api.SystemRole.ORGANIZATION);
        return roles;
    }
}
