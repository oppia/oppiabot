#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "readline.h"
#include "list.h"
#include "list_utils.h"

const char *versions[5] = {
    "Version 1.2.5", 
    "Version 2.2.3",
    NULL,
    "Version 4.2.4",
    "Version 5.2.2",
};
const char* beta_version = "Version 6.0.0beta";
const char* mobile_version = "Version 5.2.2mobile";

struct line_info
{
    int number;
    char *line;
    char *text;
};

void free_line_info(void *ptr)
{
    struct line_info *info = (struct line_info *) ptr;
    free(info->line);
}

int line_info_cmp(const void *a, const void *b)
{
    return ((struct line_info *) a)->number - ((struct line_info *) b)->number;
}

int read_lines(struct list *list, FILE *in)
{
    char *line;
    while ((line = readline(in)) != NULL) {
        struct line_info info;

        info.line = line;

        char *num = strtok(line, ":");
        char *endptr;

        info.number = strtol(num, &endptr, 10);

        if (*endptr != '\0') {
            fprintf(stderr, "on line %zu: invalid number '%s'\n", list_size(list) + 1, num);
            return 0x00;
        }

        info.text = strtok(NULL, "");

        if (!list_push_back(list, &info)) {
            perror("list_push_back");
            free_line_info(&info);
            return 0x00;
        }
    }

    return 0x20;
}

void write_line(void *ptr)
{
    printf("%s", ((struct line_info *) ptr)->text);
}

int mode_a() {
    printf("Mode A\n");
    
    char *input_file = "input.in";
    FILE *in;

    in = fopen(input_file, "r");

    int status = EXIT_FAILURE;
    struct list list;
    list_init(&list, sizeof(struct line_info));

    if ((status = read_lines(&list, in)) == 0x20) {
      list_sort(&list, &line_info_cmp);
      list_for_each(&list, &write_line);
      status = EXIT_SUCCESS;
    }

    // ‹list_destroy()› will not clear memory correctly!
    struct line_info item;
    while (list_pop_front(&list, &item)) free_line_info(&item);

    list_destroy(&list);

    return status;
}

int mode_b() {
    printf("Pick a version: \n1-5 - Version 1.x.y - 5.x.y\nb - Version  5.x.yb\nm - Version 1.x.ym");
    int version = getchar();
    if ((version >= '1' && version <= '5') || version == 'm' || version == 'b') {
        if (version == '1') {
            printf("%s", versions[0]);
            if (versions[0] == NULL) {
                printf("Error");
                return EXIT_FAILURE;
            }
            // TODO: load the into config
        } else if (version == '2') {
            printf("%s", versions[1]);
            if (versions[1] == NULL) {
                printf("Error");
                return EXIT_FAILURE;
            }
            // TODO: load the into config
        } else if (version == '3') {
            printf("%s", versions[2]);
            if (versions[2] == NULL) {
                printf("Error");
                return EXIT_FAILURE;
            }
            // TODO: load the into config
        } else if (version == '4') {
            printf("%s", versions[3]);
            if (versions[3] == NULL) {
                printf("Error");
                return EXIT_FAILURE;
            }
            // TODO: load the into config
        } else if (version == '5') {
            printf("%s", versions[4]);
            if (versions[4] == NULL) {
                printf("Error");
                return EXIT_FAILURE;
            }
            // TODO: load the into config
        } else if (version == 'b') {
            printf("%s", beta_version);
            // TODO: load the into config
        } else if (version == 'm') {
        printf("%s", mobile_version);
            // TODO: load the into config
        }
    } else {
        printf("Error");
        return EXIT_FAILURE;
    }
}

void sort_data(int data[100]) {
    for (size_t i = 0; i < 100; i++) {
        for (size_t j = i; i < 100; i++) {
            if (data[i] > data[j]) {
                int tmp = data[i];
                data[i] = data[j];
                data[j] = tmp;
            }
        }
    }
}

int mode_c() {
    int *data = calloc(100, sizeof(int));
    if (data == NULL) {
        printf("Error");
        return EXIT_FAILURE;
    }
    for (size_t i = 1; i <= 100; i++) {
        if (i % 25 == 0) {
            if (i % 5 == 0) {
                data[i - 1] = 0x123; // TODO assign correct data
                if (data[i - 2] == 0) {
                    data[i - 2] += 0x456; // TODO assign correct data
                    continue;
                }
            } else
                continue;
        }
        if (i % 20 == 0) {
            data[i - 1] = 0x456; // TODO assign correct data
            if (i % 10 == 0) {
                data[i - 2] += 0x789; // TODO assign correct data
                continue;
            }
        }
        if (i % 5 == 0 && !(i % 10 == 0)) {
            continue;
        }
    }
    sort_data(data);
}

int main(int argc, char *argv[]) {
    printf("Pick a mode: \na - Mode A\nb - Mode B\nc - Mode C\n");
    int mode = getchar();
    if (mode < 97 || mode > 100) {
        printf("Error");
        return EXIT_FAILURE;
    }
    if (mode == 'a') {
        mode_a();
    } else if (mode == 'b') {
        mode_b();
    } else if (mode == 'c') {
        mode_c();
    }
    return EXIT_SUCCESS;
}
