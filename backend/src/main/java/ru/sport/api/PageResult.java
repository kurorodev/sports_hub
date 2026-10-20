package ru.sport.api;

import java.util.List;

public record PageResult<T>(List<T> items, int page, int size, long total, int totalPages) {
    public static int offset(int page,int size) {
        if (page < 0 || size < 1 || size > 100 || (long)page*size > Integer.MAX_VALUE)
            throw Problem.invalid("page должен быть >= 0, size от 1 до 100");
        return page*size;
    }
    public static <T> PageResult<T> of(List<T> items,int page,int size,long total) {
        offset(page,size);
        return new PageResult<>(items,page,size,total,(int)((total+size-1)/size));
    }
}
