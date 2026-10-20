package ru.sport.service;

import java.net.URI;
import java.util.regex.Pattern;
import ru.sport.api.Problem;
import ru.sport.domain.UserEntity;

/** Only the character is persisted; the server chooses the uniform for each context. */
public final class AvatarImages {
    private static final Pattern BUILTIN=Pattern.compile("^/avatars/(user|organizer|admin)/((?:male|female)-0[1-5])\\.svg$");
    private AvatarImages() {}
    public static void validate(String value) {
        if(BUILTIN.matcher(value).matches())return;
        try {
            var uri=URI.create(value);
            if(value.length()>2048 || !("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) || uri.getHost()==null || uri.getUserInfo()!=null)
                throw Problem.invalid("Недопустимый avatarUrl");
        } catch(IllegalArgumentException ex){throw Problem.invalid("Недопустимый avatarUrl");}
    }
    public static String normalize(String value) {
        if(value==null)return null;
        validate(value);var match=BUILTIN.matcher(value);
        return match.matches()?"/avatars/user/"+match.group(2)+".svg":value;
    }
    public static String forUser(UserEntity user,boolean organizer) {
        String character;
        if(user.avatarUrl!=null) {
            var match=BUILTIN.matcher(user.avatarUrl);
            if(!match.matches())return user.avatarUrl;
            character=match.group(2);
        } else {
            int index=(int)(Integer.toUnsignedLong(user.id.toString().hashCode())%10);
            character=(index<5?"male":"female")+"-0"+(index%5+1);
        }
        String tone=user.admin?"admin":organizer?"organizer":"user";
        return "/avatars/"+tone+"/"+character+".svg";
    }
}
