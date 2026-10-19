package ru.dvizh.api;

import java.util.UUID;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.*;
import ru.dvizh.service.ProfileService;

@RestController @RequestMapping("/api/v1")
public class ProfileController {
    private final ProfileService profiles;
    public ProfileController(ProfileService profiles){this.profiles=profiles;}
    @GetMapping("/users") public java.util.List<Api.PublicUser> search(@RequestParam String nicknamePrefix){return profiles.search(nicknamePrefix);}
    @GetMapping("/me/profile") public Api.UserProfile me(){return profiles.me();}
    @PatchMapping("/me/profile") public Api.UserProfile patch(@RequestBody JsonNode patch){return profiles.patch(patch);}
    @GetMapping("/users/{userId}") public Api.UserProfile get(@PathVariable UUID userId){return profiles.get(userId);}
    @GetMapping("/users/{userId}/rating") public Api.Rating rating(@PathVariable UUID userId){return profiles.rating(userId);}
    @GetMapping("/users/{userId}/rating-history") public PageResult<Api.RatingLedgerEntry> history(@PathVariable UUID userId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return profiles.history(userId,page,size);}
}
