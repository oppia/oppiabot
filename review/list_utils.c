#include "list_utils.h"

#include <assert.h>
#include <string.h>

#include "list.h"

// swaps values between two nodes
static void swap_node_data(const struct list *list, struct node *a, struct node *b)
{
    assert(list != NULL);
    assert(a != NULL);
    assert(b != NULL);

    char tmp;
    for (size_t byte = 0; byte < list->elem_size; ++byte) {
        tmp = a->data[byte];
        a->data[byte] = b->data[byte];
        b->data[byte] = tmp;
    }
}

void list_for_each(struct list *list, action f)
{
    assert(list != NULL);
    assert(f != NULL);

    for (struct node *node = list->head; node != NULL; node = node->next)
        f(node->data);
}

void list_sort(struct list *list, comparator cmp)
{
    assert(list != NULL);
    assert(cmp != NULL);

    // this implementation uses improved bubblesort that counts swaps
    // in each iteration
    for (struct node *right = list->tail; right != NULL; right = right->prev) {
        size_t swaps = 0U;

        for (struct node *swp = list->head; swp != right; swp = swp->next) {
            if (cmp(swp->data, swp->next->data) > 0) {
                swap_node_data(list, swp, swp->next);
                ++swaps;
            }
        }

        // if there were no swaps, the list is sorted and we may end
        if (swaps == 0U)
            return;
    }
}
