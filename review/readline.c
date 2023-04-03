#include "readline.h"

#include <assert.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char *readline(FILE *file)
{
    assert(file != NULL);
    size_t capacity = 0u;
    size_t length = 0u;
    size_t chunk_size = 64u;
    size_t offset = 0u;
    char *memory = NULL;
    char *last_chunk;

    do {
        char *tmp;

        // increase buffer size
        capacity += chunk_size;
        if ((tmp = realloc(memory, capacity)) == NULL) {
            free(memory);
            return NULL;
        }

        // read next chunk
        memory = tmp;
        last_chunk = memory + length - offset;

        if (fgets(last_chunk, chunk_size + offset, file) == NULL)
            break;

        offset = 1;
        length += chunk_size;

        // found newline?
    } while (strchr(last_chunk, '\n') == NULL);

    if (length == 0u || ferror(file)) {
        free(memory);
        return NULL;
    }

    return memory;
}
